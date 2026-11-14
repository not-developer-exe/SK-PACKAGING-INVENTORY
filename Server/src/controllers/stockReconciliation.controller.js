const mongoose = require('mongoose');
const ReelUnit = require('../models/ReelUnit.model');
const StockReconciliation = require('../models/StockReconciliation.model');
const StockMovement = require('../models/StockMovement.model');
const Sequence = require('../models/Sequence.model');
const AuditLog = require('../models/AuditLog.model');
const { calculateReelReconciliation } = require('../utils/reelReconciliation');
const { buildDateRangeFilter } = require('../utils/dateFilters');

const asNumber = (value) => {
  if (value === '' || value === null || value === undefined) return NaN;
  return Number(value);
};

exports.getReconciliationCandidates = async (req, res) => {
  try {
    const reels = await ReelUnit.find({ status: { $in: ['available', 'partial'] } })
      .select('reelCode reelWidthInches bf gsm quality originalWeightKg remainingWeightKg ratePerKg status')
      .sort({ reelCode: 1 })
      .lean();
    return res.json({
      reels: reels.map((reel) => ({
        ...reel,
        originalWeightKg: Number(reel.originalWeightKg?.toString?.() ?? reel.originalWeightKg),
        remainingWeightKg: Number(reel.remainingWeightKg?.toString?.() ?? reel.remainingWeightKg),
        ratePerKg: Number(reel.ratePerKg?.toString?.() ?? reel.ratePerKg)
      }))
    });
  } catch (error) {
    console.error('[STOCK RECONCILIATION] Candidate query failed:', error.message);
    return res.status(500).json({ message: 'Unable to load reels for physical count.' });
  }
};

exports.getStockReconciliations = async (req, res) => {
  try {
    const filter = buildDateRangeFilter(req.query.from, req.query.to, 'countedAt');
    const reconciliations = await StockReconciliation.find(filter)
      .populate('createdBy', 'name email')
      .sort({ countedAt: -1, createdAt: -1 })
      .limit(1000)
      .lean();
    return res.json({ reconciliations });
  } catch (error) {
    console.error('[STOCK RECONCILIATION] History query failed:', error.message);
    return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Unable to load reconciliation history.' });
  }
};

exports.postStockReconciliation = async (req, res) => {
  const { reason, countedAt, lines } = req.body || {};
  const parsedDate = countedAt ? new Date(countedAt) : new Date();
  if (typeof reason !== 'string' || reason.trim().length < 5 ||
      Number.isNaN(parsedDate.getTime()) || !Array.isArray(lines) || !lines.length) {
    return res.status(400).json({ message: 'Provide a valid count date, reason and at least one reel count.' });
  }

  const seen = new Set();
  const normalized = [];
  for (const line of lines) {
    if (!line || typeof line.reelId !== 'string' || seen.has(line.reelId)) {
      return res.status(400).json({ message: 'Each reel must appear exactly once in a reconciliation.' });
    }
    seen.add(line.reelId);
    const counted = asNumber(line.countedWeightKg);
    if (!Number.isFinite(counted) || counted < 0) {
      return res.status(400).json({ message: 'Counted reel weights must be zero or a positive number.' });
    }
    normalized.push({ reelId: line.reelId, countedWeightKg: counted });
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const reelIds = normalized.map((line) => new mongoose.Types.ObjectId(line.reelId));
      const reels = await ReelUnit.find({ _id: { $in: reelIds }, status: { $in: ['available', 'partial'] } }).session(session);
      if (reels.length !== normalized.length) {
        throw new Error('One or more reels are no longer active. Refresh the count sheet and try again.');
      }

      const reelMap = new Map(reels.map((reel) => [String(reel._id), reel]));
      const linesToSave = [];
      let totalVariance = 0;
      for (const line of normalized) {
        const reel = reelMap.get(line.reelId);
        const systemWeight = Number(reel.remainingWeightKg.toString());
        const originalWeight = Number(reel.originalWeightKg.toString());
        let calculation;
        try {
          calculation = calculateReelReconciliation({ originalWeightKg: originalWeight, systemWeightKg: systemWeight, countedWeightKg: line.countedWeightKg });
        } catch (error) {
          throw new Error(error.message + ' Reel: ' + reel.reelCode + '.');
        }
        const variance = calculation.varianceKg;
        totalVariance += variance;
        linesToSave.push({
          reelId: reel._id,
          reelCode: reel.reelCode,
          specificationSummary: reel.reelWidthInches + '" | BF ' + reel.bf + ' | ' + reel.gsm + ' GSM | ' + reel.quality,
          systemWeightKg: systemWeight,
          countedWeightKg: line.countedWeightKg,
          varianceKg: variance
        });
      }

      const sequence = await Sequence.findOneAndUpdate(
        { _id: 'stock-reconciliation' },
        [{ $set: { value: { $add: [{ $ifNull: ['$value', 0] }, 1] } } }],
        { new: true, upsert: true, session }
      );
      const reconciliationNumber = 'RC-' + String(sequence.value).padStart(5, '0');
      const [reconciliation] = await StockReconciliation.create([{
        reconciliationNumber,
        countedAt: parsedDate,
        reason: reason.trim(),
        lines: linesToSave,
        totalVarianceKg: totalVariance,
        createdBy: req.user._id
      }], { session });

      for (const line of linesToSave) {
        const reel = reelMap.get(String(line.reelId));
        const oldWeight = Number(line.systemWeightKg.toString());
        const newWeight = Number(line.countedWeightKg.toString());
        const delta = newWeight - oldWeight;
        if (delta !== 0) {
          const updated = await ReelUnit.updateOne(
            { _id: reel._id, remainingWeightKg: reel.remainingWeightKg, status: reel.status },
            {
              $set: {
                remainingWeightKg: newWeight,
                status: calculateReelReconciliation({ originalWeightKg: reel.originalWeightKg.toString(), systemWeightKg: oldWeight, countedWeightKg: newWeight }).status
              }
            },
            { session }
          );
          if (updated.modifiedCount !== 1) throw new Error('Stock changed while this count was being posted. Refresh and retry.');

          await StockMovement.create([{
            movementDate: parsedDate,
            movementType: 'adjustment',
            referenceId: reconciliation._id,
            referenceModel: 'StockReconciliation',
            itemType: 'reel',
            specificationSummary: line.specificationSummary,
            quantityChange: 0,
            weightChangeKg: delta,
            notes: 'Physical count ' + reconciliationNumber + ' for ' + line.reelCode + ': ' + reason.trim(),
            performedBy: req.user._id
          }], { session });
        }
      }

      await AuditLog.create([{
        action: 'stock.reconciled',
        entityType: 'StockReconciliation',
        entityId: reconciliation._id,
        entityLabel: reconciliationNumber,
        actorId: req.user._id,
        actorName: req.user.name,
        actorRole: req.user.role,
        summary: 'Physical reel count posted for ' + linesToSave.length + ' reels. Net variance: ' + totalVariance.toFixed(3) + ' kg.',
        metadata: { reason: reason.trim(), totalVarianceKg: totalVariance, reelCount: linesToSave.length }
      }], { session });
      result = reconciliation;
    });
    return res.status(201).json({ message: 'Physical stock count reconciled and ledger-adjusted.', reconciliation: result });
  } catch (error) {
    console.error('[STOCK RECONCILIATION] Posting failed:', error.message);
    const clientError = error.name === 'ValidationError' || error.name === 'CastError' || /no longer active|cannot exceed|Stock changed/.test(error.message);
    return res.status(clientError ? 409 : 500).json({ message: clientError ? error.message : 'Reconciliation failed. No stock changes were committed.' });
  } finally {
    await session.endSession();
  }
};
