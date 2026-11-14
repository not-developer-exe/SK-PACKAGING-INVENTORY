const mongoose = require('mongoose');
const OpeningStockAdjustment = require('../models/OpeningStockAdjustment.model');
const ReelUnit = require('../models/ReelUnit.model');
const StockMovement = require('../models/StockMovement.model');
const Sequence = require('../models/Sequence.model');
const AuditLog = require('../models/AuditLog.model');
const { buildDateRangeFilter } = require('../utils/dateFilters');

const number = (value) => {
  if (value === '' || value === null || value === undefined) return NaN;
  return Number(value);
};

exports.getOpeningStockAdjustments = async (req, res) => {
  try {
    const filter = buildDateRangeFilter(req.query.from, req.query.to, 'adjustmentDate');
    const adjustments = await OpeningStockAdjustment.find(filter)
      .populate('createdBy', 'name email')
      .sort({ adjustmentDate: -1, createdAt: -1 })
      .limit(1000)
      .lean();
    return res.json({ adjustments });
  } catch (error) {
    console.error('[OPENING STOCK] History failed:', error.message);
    return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Unable to fetch opening stock history.' });
  }
};

exports.createOpeningStockAdjustment = async (req, res) => {
  const { adjustmentDate, reason, lines } = req.body || {};
  const parsedDate = adjustmentDate ? new Date(adjustmentDate) : new Date();

  if (Number.isNaN(parsedDate.getTime()) || typeof reason !== 'string' || reason.trim().length < 5 ||
      !Array.isArray(lines) || lines.length === 0) {
    return res.status(400).json({ message: 'A valid date, reason (at least 5 characters), and at least one reel line are required.' });
  }

  const normalizedLines = [];
  for (const line of lines) {
    if (!line || typeof line !== 'object' || Array.isArray(line)) {
      return res.status(400).json({ message: 'Every opening stock line must be a valid object.' });
    }
    const width = number(line.reelWidthInches);
    const bf = number(line.bf);
    const gsm = number(line.gsm);
    const rate = number(line.ratePerKg);
    const weights = line.reelWeightsKg;
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(bf) || bf <= 0 ||
        !Number.isFinite(gsm) || gsm <= 0 || !['Natural', 'GY'].includes(line.quality) ||
        !Number.isFinite(rate) || rate < 0 || !Array.isArray(weights) || weights.length === 0 ||
        weights.some((weight) => !Number.isFinite(number(weight)) || number(weight) <= 0)) {
      return res.status(400).json({ message: 'Each line needs valid dimensions, quality, rate and a positive weight for every physical reel.' });
    }
    normalizedLines.push({
      reelWidthInches: width, bf, gsm, quality: line.quality,
      ratePerKg: rate, reelWeightsKg: weights.map(number)
    });
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const existingCount = await ReelUnit.countDocuments().session(session);
      const totalReels = normalizedLines.reduce((sum, line) => sum + line.reelWeightsKg.length, 0);
      const totalWeight = normalizedLines.reduce((sum, line) => sum + line.reelWeightsKg.reduce((a,b) => a+b,0), 0);
      const sequence = await Sequence.findOneAndUpdate(
        { _id: 'opening-stock-adjustment' },
        [{ $set: { value: { $add: [{ $max: [{ $ifNull: ['$value', 0] }, 0] }, 1] } } }],
        { new: true, upsert: true, session }
      );
      const reelSequence = await Sequence.findOneAndUpdate(
        { _id: 'reel-unit' },
        [{ $set: { value: { $add: [{ $max: [{ $ifNull: ['$value', existingCount] }, existingCount] }, totalReels] } } }],
        { new: true, upsert: true, session }
      );
      let reelCodeCounter = reelSequence.value - totalReels;
      const adjustmentNumber = 'OS-' + String(sequence.value).padStart(5, '0');
      const [adjustment] = await OpeningStockAdjustment.create([{
        adjustmentNumber,
        adjustmentDate: parsedDate,
        reason: reason.trim(),
        lines: normalizedLines.map(line => ({ ...line, reelIds: [] })),
        totalReels,
        totalWeightKg: totalWeight,
        createdBy: req.user._id
      }], { session });

      for (let index = 0; index < normalizedLines.length; index += 1) {
        const line = normalizedLines[index];
        const reelDocs = line.reelWeightsKg.map((weight) => {
          reelCodeCounter += 1;
          return {
            reelCode: 'RL-' + String(reelCodeCounter).padStart(6, '0'),
            reelWidthInches: line.reelWidthInches,
            bf: line.bf,
            gsm: line.gsm,
            quality: line.quality,
            supplierId: null,
            inwardReceiptId: null,
            openingStockAdjustmentId: adjustment._id,
            sourceType: 'opening_balance',
            batchReference: adjustmentNumber,
            originalWeightKg: weight,
            remainingWeightKg: weight,
            ratePerKg: line.ratePerKg,
            landedRatePerKg: line.ratePerKg,
            status: 'available'
          };
        });
        const createdReels = await ReelUnit.create(reelDocs, { session, ordered: true });
        adjustment.lines[index].reelIds = createdReels.map(reel => reel._id);
        await StockMovement.create([{
          movementType: 'adjustment',
          referenceId: adjustment._id,
          referenceModel: 'OpeningStockAdjustment',
          itemType: 'reel',
          specificationSummary: line.reelWidthInches + '" | BF ' + line.bf + ' | ' + line.gsm + ' GSM | ' + line.quality,
          quantityChange: line.reelWeightsKg.length,
          weightChangeKg: line.reelWeightsKg.reduce((sum, weight) => sum + weight, 0),
          notes: 'Opening stock ' + adjustmentNumber + ': ' + reason.trim(),
          performedBy: req.user._id
        }], { session });
      }

      await adjustment.save({ session });
      await AuditLog.create([{
        action: 'opening_stock.created',
        entityType: 'OpeningStockAdjustment',
        entityId: adjustment._id,
        entityLabel: adjustmentNumber,
        actorId: req.user._id,
        actorName: req.user.name,
        actorRole: req.user.role,
        summary: 'Opening reel stock recorded: ' + totalReels + ' reels / ' + totalWeight.toFixed(3) + ' kg.',
        metadata: {
          reason: reason.trim(),
          totalReels,
          totalWeightKg: totalWeight,
          lines: normalizedLines.map(line => ({
            reelWidthInches: line.reelWidthInches,
            bf: line.bf,
            gsm: line.gsm,
            quality: line.quality,
            reelWeightsKg: line.reelWeightsKg,
            ratePerKg: line.ratePerKg
          }))
        }
      }], { session });
      result = adjustment;
    });

    return res.status(201).json({ message: 'Opening stock posted and audited.', adjustment: result });
  } catch (error) {
    console.error('[OPENING STOCK] Creation failed:', error.message);
    return res.status(error.name === 'ValidationError' || error.name === 'CastError' ? 400 : 500)
      .json({ message: 'Opening stock could not be posted. No stock changes were committed.' });
  } finally {
    await session.endSession();
  }
};

exports.getAuditLogs = async (req, res) => {
  try {
    const filter = buildDateRangeFilter(req.query.from, req.query.to, 'createdAt');
    const logs = await AuditLog.find(filter)
      .populate('actorId', 'name email')
      .sort({ createdAt: -1 })
      .limit(1000)
      .lean();
    return res.json({ logs });
  } catch (error) {
    console.error('[AUDIT] Query failed:', error.message);
    return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Unable to fetch audit history.' });
  }
};
