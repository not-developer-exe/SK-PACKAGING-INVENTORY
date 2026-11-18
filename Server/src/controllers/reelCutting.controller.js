const mongoose = require('mongoose');
const ReelUnit = require('../models/ReelUnit.model');
const CutSheetBatch = require('../models/CutSheetBatch.model');
const StockMovement = require('../models/StockMovement.model');
const Sequence = require('../models/Sequence.model');
const writeAuditLog = require('../utils/writeAuditLog');
const { resolveLandedRatePerKg, calculateMaterialCost } = require('../utils/materialCosting');
const { buildDateRangeFilter, isValidDateOnly } = require('../utils/dateFilters');

const companyFilter = (req) => req.companyKey === 'nsb-industrial-solutions'
  ? { companyKey: 'nsb-industrial-solutions' }
  : { $or: [{ companyKey: 'sk-packaging' }, { companyKey: { $exists: false } }] };

exports.getCuttingRegister = async (req, res) => {
  try {
    const reels = await ReelUnit.find({ ...companyFilter(req), status: { $in: ['available', 'partial'] } })
      .select('reelCode reelWidthInches bf gsm quality remainingWeightKg ratePerKg landedRatePerKg')
      .sort({ reelCode: 1 }).lean();
    const filter = { ...companyFilter(req), ...buildDateRangeFilter(req.query.from, req.query.to, 'cutDate') };
    const batches = await CutSheetBatch.find(filter).sort({ cutDate: -1, createdAt: -1 }).limit(1000).lean();
    return res.json({ reels, batches });
  } catch (error) {
    console.error('[REEL CUTTING] Register failed:', error.message);
    return res.status(500).json({ message: 'Unable to fetch reel cutting register.' });
  }
};

exports.recordCutting = async (req, res) => {
  const { inputs, notes = '' } = req.body || {};
  const cutDateRaw = req.body?.cutDate;
  const lengthInches = Number(req.body?.lengthInches);
  const widthInches = Number(req.body?.widthInches);
  const sheetCount = Number(req.body?.sheetCount);
  const outputWeightKg = Number(req.body?.outputWeightKg);
  const recoverableWasteKg = Number(req.body?.recoverableWasteKg || 0);

  if (cutDateRaw !== undefined && !isValidDateOnly(cutDateRaw)) return res.status(400).json({ message: 'Cutting date must be a valid YYYY-MM-DD date.' });
  if (!Array.isArray(inputs) || inputs.length < 1 || inputs.length > 10 ||
      inputs.some((x) => !x || !mongoose.isValidObjectId(x.reelId) || !Number.isFinite(Number(x.weightConsumedKg)) || Number(x.weightConsumedKg) <= 0) ||
      new Set(inputs.map((x) => String(x.reelId))).size !== inputs.length) {
    return res.status(400).json({ message: 'Select 1–10 distinct reels and enter a positive consumed weight for each.' });
  }
  if (![lengthInches, widthInches, outputWeightKg].every(Number.isFinite) || lengthInches <= 0 || widthInches <= 0 ||
      !Number.isInteger(sheetCount) || sheetCount <= 0 || outputWeightKg <= 0 ||
      !Number.isFinite(recoverableWasteKg) || recoverableWasteKg < 0 || typeof notes !== 'string' || notes.length > 1000) {
    return res.status(400).json({ message: 'Enter valid sheet dimensions, whole sheet count, output weight and non-negative recoverable waste.' });
  }
  const totalInputKg = inputs.reduce((sum, x) => sum + Number(x.weightConsumedKg), 0);
  if (outputWeightKg + recoverableWasteKg > totalInputKg + 0.000001) {
    return res.status(400).json({ message: 'Output sheets plus recoverable waste cannot exceed the reel weight issued.' });
  }
  const processLossKg = Number((totalInputKg - outputWeightKg - recoverableWasteKg).toFixed(3));
  const cutDate = cutDateRaw ? new Date(cutDateRaw + 'T00:00:00+05:30') : new Date();
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const existingCount = await CutSheetBatch.countDocuments(companyFilter(req)).session(session);
      const sequence = await Sequence.findOneAndUpdate(
        { _id: 'reel-cut-sheet' },
        [{ $set: { value: { $add: [{ $max: [{ $ifNull: ['$value', existingCount] }, existingCount] }, 1] } } }],
        { new: true, upsert: true, session, updatePipeline: true }
      );
      const batchNumber = 'CS-' + String(sequence.value).padStart(6, '0');
      const sourceReels = [];
      for (const line of inputs) {
        const weight = Number(line.weightConsumedKg);
        const reel = await ReelUnit.findOne({ _id: line.reelId, ...companyFilter(req), status: { $in: ['available', 'partial'] } }).session(session);
        if (!reel) { const e = new Error('A selected reel is unavailable or outside S.K Packaging.'); e.statusCode = 409; throw e; }
        const current = Number(reel.remainingWeightKg.toString());
        if (current + 1e-9 < weight) { const e = new Error('Insufficient balance in reel ' + reel.reelCode + '. Available ' + current + ' kg.'); e.statusCode = 409; throw e; }
        const next = Math.max(0, Number((current - weight).toFixed(6)));
        const updated = await ReelUnit.findOneAndUpdate(
          { _id: reel._id, ...companyFilter(req), remainingWeightKg: reel.remainingWeightKg, status: reel.status },
          { $set: { remainingWeightKg: mongoose.Types.Decimal128.fromString(String(next)), status: next === 0 ? 'consumed' : 'partial' } },
          { new: true, session }
        );
        if (!updated) { const e = new Error('Reel ' + reel.reelCode + ' stock changed. Refresh and retry.'); e.statusCode = 409; throw e; }
        const landedRate = resolveLandedRatePerKg(reel.landedRatePerKg?.toString() || 0, reel.ratePerKg.toString());
        const materialCost = calculateMaterialCost(weight, landedRate);
        sourceReels.push({ reelId: reel._id, reelCode: reel.reelCode, weightConsumedKg: mongoose.Types.Decimal128.fromString(String(weight)), landedRatePerKg: mongoose.Types.Decimal128.fromString(String(landedRate)), materialCost: mongoose.Types.Decimal128.fromString(String(materialCost)) });
        await StockMovement.create([{
          movementDate: cutDate, movementType: 'sheet_cutting', referenceId: reel._id, referenceModel: 'ReelUnit',
          itemType: 'reel', specificationSummary: 'Reel ' + reel.reelCode + ' → ' + lengthInches + '×' + widthInches + ' inch cut sheets | ' + batchNumber,
          quantityChange: next === 0 ? -1 : 0, weightChangeKg: mongoose.Types.Decimal128.fromString(String(-weight)),
          notes: 'Issued to in-house cutter for ' + batchNumber, performedBy: req.user?._id
        }], { session });
      }
      const totalMaterialCost = Number(sourceReels.reduce((sum, x) => sum + Number(x.materialCost.toString()), 0).toFixed(2));
      const unitCostPerKg = totalMaterialCost / outputWeightKg;
      const [batch] = await CutSheetBatch.create([{
        companyKey: req.companyKey || 'sk-packaging', batchNumber, cutDate, lengthInches, widthInches,
        sheetCount, remainingSheets: sheetCount,
        totalWeightKg: mongoose.Types.Decimal128.fromString(String(outputWeightKg)),
        remainingWeightKg: mongoose.Types.Decimal128.fromString(String(outputWeightKg)),
        totalMaterialCost: mongoose.Types.Decimal128.fromString(String(totalMaterialCost)),
        unitCostPerKg: mongoose.Types.Decimal128.fromString(String(unitCostPerKg)),
        recoverableWasteKg: mongoose.Types.Decimal128.fromString(String(recoverableWasteKg)),
        processLossKg: mongoose.Types.Decimal128.fromString(String(processLossKg)),
        sourceReels, notes: notes.trim(), recordedBy: req.user?._id
      }], { session });
      await StockMovement.create([{
        movementDate: cutDate, movementType: 'sheet_cutting', referenceId: batch._id, referenceModel: 'CutSheetBatch',
        itemType: 'sheet', specificationSummary: batchNumber + ' | ' + sheetCount + ' sheets | ' + lengthInches + '×' + widthInches + ' inch',
        quantityChange: sheetCount, weightChangeKg: mongoose.Types.Decimal128.fromString(String(outputWeightKg)),
        notes: 'Cut-sheet batch created from ' + sourceReels.map((x) => x.reelCode).join(', '), performedBy: req.user?._id
      }], { session });
      await writeAuditLog(req, {
        action: 'reel_cutting.completed', entityType: 'CutSheetBatch', entityId: batch._id, entityLabel: batchNumber,
        summary: 'Converted ' + totalInputKg.toFixed(3) + ' kg of reels into ' + sheetCount + ' cut sheets (' + outputWeightKg + ' kg).',
        metadata: { batchNumber, totalInputKg, outputWeightKg, recoverableWasteKg, processLossKg, totalMaterialCost }
      }, session);
      result = batch;
    });
    return res.status(201).json({ batch: result });
  } catch (error) {
    console.error('[REEL CUTTING] Save failed:', error.message);
    return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Unable to record reel cutting.' });
  } finally {
    await session.endSession();
  }
};
