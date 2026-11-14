const mongoose = require('mongoose');
const ProductionRun = require('../models/ProductionRun.model');
const CorrugatedSheet = require('../models/CorrugatedSheet.model');
const ReelUnit = require('../models/ReelUnit.model');
const StockMovement = require('../models/StockMovement.model');
const Sequence = require('../models/Sequence.model');
const { calculateProductionBalance } = require('../utils/productionAccounting');
const writeAuditLog = require('../utils/writeAuditLog');
const { calculateWidthSubstitution } = require('../utils/widthSubstitution');
const { resolveLandedRatePerKg, calculateMaterialCost, calculateUnitMaterialCost } = require('../utils/materialCosting');
const { buildDateRangeFilter, isValidDateOnly } = require('../utils/dateFilters');

exports.getProductionRuns = async (req, res) => {
  try {
    const filter = buildDateRangeFilter(req.query.from, req.query.to, 'runDate');
    const runs = await ProductionRun.find(filter)
      .sort({ runDate: -1, createdAt: -1 })
      .limit(1000)
      .populate('recordedBy', 'name')
      .lean();
    const runIds = runs.map((run) => run._id);
    const sheets = await CorrugatedSheet.find({ productionRunId: { $in: runIds } })
      .select('productionRunId ply lengthInches widthInches sheetCount totalWeightKg unitCostPerKg costingStatus status')
      .lean();
    const sheetsByRun = new Map();
    for (const sheet of sheets) {
      const key = String(sheet.productionRunId);
      if (!sheetsByRun.has(key)) sheetsByRun.set(key, []);
      sheetsByRun.get(key).push(sheet);
    }
    return res.json({
      runs: runs.map((run) => ({
        ...run,
        outputSheets: sheetsByRun.get(String(run._id)) || [],
        widthSubstitutions: (run.inputReels || []).filter((input) => Number(input.widthVarianceInches || 0) !== 0)
      }))
    });
  } catch (error) {
    console.error('[PRODUCTION] History query failed:', error.message);
    return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Unable to fetch production history.' });
  }
};

exports.recordProduction = async (req, res) => {
  const {
    shift,
    operatorName,
    runDate: rawRunDate,
    inputReels,
    outputSheets,
    recoverableWasteKg: rawRecoverableWasteKg
  } = req.body || {};

  if (rawRunDate !== undefined && !isValidDateOnly(rawRunDate)) {
    return res.status(400).json({ message: 'Production date must be a real calendar date in YYYY-MM-DD format.' });
  }
  const runDate = rawRunDate ? new Date(rawRunDate + 'T00:00:00+05:30') : new Date();

  if (!Array.isArray(inputReels) || inputReels.length === 0 ||
      !Array.isArray(outputSheets) || outputSheets.length === 0) {
    return res.status(400).json({ message: 'Both input reels and output sheets are required.' });
  }
  if (inputReels.some((item) => !item || typeof item !== 'object') ||
      outputSheets.some((item) => !item || typeof item !== 'object')) {
    return res.status(400).json({ message: 'Input reel and output sheet lines must be valid objects.' });
  }

  const recoverableWasteKg = rawRecoverableWasteKg === undefined || rawRecoverableWasteKg === null || rawRecoverableWasteKg === ''
    ? 0
    : Number(rawRecoverableWasteKg);
  if (!Number.isFinite(recoverableWasteKg) || recoverableWasteKg < 0) {
    return res.status(400).json({ message: 'Measured recoverable scrap must be a non-negative number.' });
  }

  const inputs = inputReels.map((item) => ({
    ...item,
    weightConsumedKg: Number(item.weightConsumedKg),
    requestedWidthInches: item.requestedWidthInches === undefined || item.requestedWidthInches === ''
      ? null
      : Number(item.requestedWidthInches)
  }));
  const outputs = outputSheets.map((item) => ({
    ...item,
    totalWeightKg: Number(item.totalWeightKg),
    sheetCount: Number(item.sheetCount),
    lengthInches: Number(item.lengthInches),
    widthInches: Number(item.widthInches)
  }));

  if (inputs.some((item) => !mongoose.isValidObjectId(item.reelId) || !Number.isFinite(item.weightConsumedKg) || item.weightConsumedKg <= 0 ||
      (item.requestedWidthInches !== null && (!Number.isFinite(item.requestedWidthInches) || item.requestedWidthInches <= 0)))) {
    return res.status(400).json({ message: 'Every input reel needs a valid ID, positive consumed weight and, when supplied, a positive requested width.' });
  }
  if (new Set(inputs.map((item) => String(item.reelId))).size !== inputs.length) {
    return res.status(400).json({ message: 'A reel can appear only once in a production run. Combine its consumed weight into one line.' });
  }
  if (outputs.some((item) => !Number.isFinite(item.totalWeightKg) || item.totalWeightKg <= 0 ||
      !Number.isInteger(item.sheetCount) || item.sheetCount <= 0 ||
      !Number.isFinite(item.lengthInches) || item.lengthInches <= 0 ||
      !Number.isFinite(item.widthInches) || item.widthInches <= 0 || ![3, 5, 7, 9].includes(Number(item.ply)))) {
    return res.status(400).json({ message: 'Every output line must have positive dimensions, weight and a whole-number sheet count.' });
  }

  const totalInputWeight = inputs.reduce((sum, item) => sum + item.weightConsumedKg, 0);
  const totalOutputWeight = outputs.reduce((sum, item) => sum + item.totalWeightKg, 0);
  let productionBalance;
  try {
    productionBalance = calculateProductionBalance(totalInputWeight, totalOutputWeight, recoverableWasteKg);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
  const processLossKg = productionBalance.processLossKg;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const existingCount = await ProductionRun.countDocuments().session(session);
    const sequence = await Sequence.findOneAndUpdate(
      { _id: 'production-run' },
      [{ $set: { value: { $add: [{ $max: [{ $ifNull: ['$value', existingCount] }, existingCount] }, 1] } } }],
      { new: true, upsert: true, session, updatePipeline: true }
    );
    const runNumber = 'PR-' + String(sequence.value).padStart(5, '0');

    const tracedInputs = [];
    for (const input of inputs) {
      const consumedWeight = input.weightConsumedKg;
      const reel = await ReelUnit.findById(input.reelId).session(session);
      if (!reel || !['available', 'partial'].includes(reel.status)) {
        const error = new Error('Reel ' + input.reelId + ' is not available for production.');
        error.statusCode = 409;
        throw error;
      }

      const currentWeight = Number(reel.remainingWeightKg.toString());
      if (currentWeight + 1e-9 < consumedWeight) {
        const error = new Error('Insufficient weight in Reel ' + reel.reelCode + '. Available: ' + currentWeight + 'kg, Requested: ' + consumedWeight + 'kg');
        error.statusCode = 409;
        throw error;
      }

      const remainingAfterIssue = Math.max(0, currentWeight - consumedWeight);
      // Keep measurable residual stock visible; only treat floating-point dust as fully consumed.
      const newWeight = remainingAfterIssue <= 1e-9 ? 0 : remainingAfterIssue;
      const newStatus = newWeight === 0 ? 'consumed' : 'partial';
      const updatedReel = await ReelUnit.findOneAndUpdate(
        { _id: reel._id, remainingWeightKg: reel.remainingWeightKg, status: reel.status },
        {
          $set: {
            remainingWeightKg: mongoose.Types.Decimal128.fromString(String(newWeight)),
            status: newStatus
          }
        },
        { new: true, session }
      );
      if (!updatedReel) {
        const error = new Error('Reel ' + reel.reelCode + ' stock changed during this entry. Refresh and try again.');
        error.statusCode = 409;
        throw error;
      }

      const actualWidthInches = Number(reel.reelWidthInches);
      const landedRatePerKg = resolveLandedRatePerKg(reel.landedRatePerKg?.toString() || 0, reel.ratePerKg.toString());
      const materialCost = calculateMaterialCost(consumedWeight, landedRatePerKg);
      const requestedWidthInches = input.requestedWidthInches || actualWidthInches;
      const widthTrace = calculateWidthSubstitution(requestedWidthInches, actualWidthInches);
      tracedInputs.push({
        reelId: reel._id,
        reelCode: reel.reelCode,
        requestedWidthInches,
        actualWidthInches,
        widthVarianceInches: widthTrace.varianceInches,
        bf: reel.bf,
        gsm: reel.gsm,
        quality: reel.quality,
        landedRatePerKg,
        materialCost,
        weightConsumedKg: consumedWeight
      });

      await StockMovement.create([{
        movementDate: runDate,
        movementType: 'production_issue',
        referenceId: reel._id,
        referenceModel: 'ReelUnit',
        itemType: 'reel',
        specificationSummary: 'Reel ' + reel.reelCode + ' | Actual ' + actualWidthInches + '" | Required ' + requestedWidthInches + '" | ' + runNumber,
        quantityChange: newStatus === 'consumed' ? -1 : 0,
        weightChangeKg: mongoose.Types.Decimal128.fromString(String(-consumedWeight)),
        notes: 'Issued to Production Run ' + runNumber +
          (widthTrace.isSubstitution ? '; width substitution ' + requestedWidthInches + '" required, ' + actualWidthInches + '" used (' + widthTrace.substitutionDirection + ')' : ''),
        performedBy: req.user._id
      }], { session, ordered: true });
    }

    const totalMaterialCost = Number(tracedInputs.reduce((sum, item) => sum + item.materialCost, 0).toFixed(2));
    const materialCostPerOutputKg = calculateUnitMaterialCost(totalMaterialCost, totalOutputWeight);

    const [run] = await ProductionRun.create([{
      runNumber,
      runDate,
      shift,
      operatorName,
      inputReels: tracedInputs,
      totalInputWeightKg: totalInputWeight,
      totalOutputWeightKg: totalOutputWeight,
      totalMaterialCost,
      materialCostPerOutputKg,
      recoverableWasteKg,
      processLossKg,
      wasteGeneratedKg: recoverableWasteKg,
      status: 'completed',
      recordedBy: req.user._id
    }], { session, ordered: true });

    for (const output of outputs) {
      const [sheet] = await CorrugatedSheet.create([{
        productionRunId: run._id,
        ply: output.ply,
        lengthInches: output.lengthInches,
        widthInches: output.widthInches,
        sheetCount: output.sheetCount,
        totalWeightKg: output.totalWeightKg,
        unitCostPerKg: materialCostPerOutputKg,
        costingStatus: 'available',
        status: 'available'
      }], { session, ordered: true });

      await StockMovement.create([{
        movementDate: runDate,
        movementType: 'sheet_cutting',
        referenceId: sheet._id,
        referenceModel: 'CorrugatedSheet',
        itemType: 'sheet',
        specificationSummary: output.ply + 'Ply | ' + output.lengthInches + 'x' + output.widthInches,
        quantityChange: output.sheetCount,
        weightChangeKg: output.totalWeightKg,
        notes: 'Produced from Run ' + runNumber,
        performedBy: req.user._id
      }], { session, ordered: true });
    }

    await writeAuditLog(req, { action: 'production.recorded', entityType: 'ProductionRun', entityId: run._id, entityLabel: runNumber, summary: 'Production run recorded: ' + runNumber, metadata: { totalInputWeightKg: totalInputWeight, totalOutputWeightKg: totalOutputWeight, totalMaterialCost, materialCostPerOutputKg, recoverableWasteKg, processLossKg, inputReelCount: tracedInputs.length, outputLineCount: outputs.length, widthSubstitutions: tracedInputs.filter((item) => item.widthVarianceInches !== 0).map((item) => ({ reelCode: item.reelCode, requestedWidthInches: item.requestedWidthInches, actualWidthInches: item.actualWidthInches, varianceInches: item.widthVarianceInches })) } }, session);
    await session.commitTransaction();
    return res.status(201).json({
      message: 'Production run recorded successfully',
      runNumber,
      wasteGeneratedKg: recoverableWasteKg,
      recoverableWasteKg,
      processLossKg
    });
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    console.error('[PRODUCTION ERROR]', error.message);
    return res.status(error.statusCode || (error.name === 'ValidationError' ? 400 : 500))
      .json({ message: error.message || 'Error recording production' });
  } finally {
    await session.endSession();
  }
};
