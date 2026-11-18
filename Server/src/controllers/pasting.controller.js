
const mongoose = require('mongoose');
const FacingMaterialBatch = require('../models/FacingMaterialBatch.model');
const PastingRun = require('../models/PastingRun.model');
const StockMovement = require('../models/StockMovement.model');
const CorrugatedSheet = require('../models/CorrugatedSheet.model');
const StockMovement = require('../models/StockMovement.model');
const Sequence = require('../models/Sequence.model');
const writeAuditLog = require('../utils/writeAuditLog');

const num = (v) => Number(v?.toString?.() ?? v ?? 0);
const dec = (v) => mongoose.Types.Decimal128.fromString(String(Number(v).toFixed(3)));
const validDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '') && !Number.isNaN(new Date(v + 'T00:00:00+05:30').getTime());

exports.receiveFacingMaterial = async (req, res) => {
  const { materialType, lengthInches, widthInches, sheetCount, totalWeightKg, ratePerKg, supplierName = '', inwardDate, notes = '' } = req.body || {};
  const length = Number(lengthInches), width = Number(widthInches), count = Number(sheetCount), weight = Number(totalWeightKg), rate = Number(ratePerKg);
  if (!['printed', 'printed_laminated', 'khaki', 'duplex'].includes(materialType) ||
      ![length, width, count, weight, rate].every(Number.isFinite) ||
      length <= 0 || width <= 0 || !Number.isInteger(count) || count <= 0 || weight <= 0 || rate < 0 ||
      !validDate(inwardDate)) return res.status(400).json({ message: 'Enter valid material type, fixed sheet dimensions, sheet count, total kg, ₹/kg rate and inward date.' });
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const existing = await FacingMaterialBatch.countDocuments().session(session);
    const seq = await Sequence.findOneAndUpdate({ _id: 'facing-material' },
      [{ $set: { value: { $add: [{ $max: [{ $ifNull: ['$value', existing] }, existing] }, 1] } } }],
      { new: true, upsert: true, session, updatePipeline: true });
    const batchNumber = 'FM-' + String(seq.value).padStart(6, '0');
    const totalValue = Number((weight * rate).toFixed(2));
    const [batch] = await FacingMaterialBatch.create([{
      batchNumber, materialType, lengthInches: length, widthInches: width, sheetCount: count,
      receivedWeightKg: dec(weight), remainingWeightKg: dec(weight), remainingSheets: count,
      ratePerKg: dec(rate), totalValue: dec(totalValue), supplierName: String(supplierName).trim(),
      inwardDate: new Date(inwardDate + 'T00:00:00+05:30'), notes: String(notes).trim(), recordedBy: req.user._id
    }], { session });
    await StockMovement.create([{ movementDate: new Date(inwardDate + 'T00:00:00+05:30'), movementType: 'inward_receipt', referenceId: batch._id, referenceModel: 'FacingMaterialBatch', itemType: 'facing_material', specificationSummary: materialType + ' ' + length + 'x' + width, quantityChange: count, weightChangeKg: dec(weight), notes: 'Facing material inward ' + batchNumber, performedBy: req.user._id }], { session });
    await writeAuditLog(req, { action: 'facing_material.received', entityType: 'FacingMaterialBatch', entityId: batch._id, entityLabel: batchNumber, summary: 'Received ' + count + ' pre-cut facing sheets (' + weight + ' kg).', metadata: { materialType, weight, rate, totalValue } }, session);
    await session.commitTransaction();
    return res.status(201).json({ batch });
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    return res.status(500).json({ message: 'Facing material inward failed; no stock was committed.' });
  } finally { await session.endSession(); }
};

exports.getFacingMaterial = async (req, res) => {
  const batches = await FacingMaterialBatch.find().sort({ inwardDate: -1, createdAt: -1 }).limit(1000).lean();
  return res.json({ batches });
};

exports.recordPasting = async (req, res) => {
  const { runDate, operatorName, machineName = '', sourceSheetId, facingBatchId, sheetsConsumed, facingSheetsConsumed, outputSheetCount, outputWeightKg, adhesiveWeightKg = 0, wasteWeightKg = 0, notes = '' } = req.body || {};
  const date = Number.isInteger(new Date(runDate + 'T00:00:00+05:30').getTime()) ? new Date(runDate + 'T00:00:00+05:30') : null;
  const used = Number(sheetsConsumed), facingUsed = Number(facingSheetsConsumed), outCount = Number(outputSheetCount);
  const outKg = Number(outputWeightKg), glueKg = Number(adhesiveWeightKg), wasteKg = Number(wasteWeightKg);
  if (!date || !validDate(runDate) || !String(operatorName || '').trim() || !mongoose.isValidObjectId(sourceSheetId) ||
      !mongoose.isValidObjectId(facingBatchId) || ![used, facingUsed, outCount, outKg, glueKg, wasteKg].every(Number.isFinite) ||
      !Number.isInteger(used) || used < 1 || !Number.isInteger(facingUsed) || facingUsed < 1 ||
      !Number.isInteger(outCount) || outCount < 1 || outCount > used || outKg <= 0 || glueKg < 0 || wasteKg < 0) {
    return res.status(400).json({ message: 'Enter valid date, operator, 2-ply batch, facing batch, quantities, output weight and waste.' });
  }
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const source = await CorrugatedSheet.findById(sourceSheetId).session(session);
    const facing = await FacingMaterialBatch.findById(facingBatchId).session(session);
    if (!source || source.status !== 'available' || source.ply !== 2 || source.sheetCount < used) {
      const e = new Error('Selected 2-ply batch is unavailable or has insufficient sheets.'); e.statusCode = 409; throw e;
    }
    if (!facing || !['available', 'partial'].includes(facing.status) || facing.remainingSheets < facingUsed) {
      const e = new Error('Selected facing-material batch is unavailable or has insufficient sheets.'); e.statusCode = 409; throw e;
    }
    if (Number(source.lengthInches) !== Number(facing.lengthInches) || Number(source.widthInches) !== Number(facing.widthInches)) {
      const e = new Error('Facing material dimensions must exactly match the selected 2-ply sheet batch.'); e.statusCode = 409; throw e;
    }
    if (used !== facingUsed || used !== outCount) {
      const e = new Error('For this 3-ply pasting workflow, 2-ply sheets consumed, facing sheets consumed and output sheets must match one-to-one.'); e.statusCode = 400; throw e;
    }
    const sourceWeight = num(source.totalWeightKg);
    const sourceUsedKg = Number((sourceWeight * used / source.sheetCount).toFixed(3));
    const facingWeight = num(facing.remainingWeightKg);
    const facingUsedKg = Number((facingWeight * facingUsed / facing.remainingSheets).toFixed(3));
    const totalInput = sourceUsedKg + facingUsedKg + glueKg;
    if (outKg + wasteKg > totalInput + 0.01) {
      const e = new Error('Output weight plus recorded waste cannot exceed 2-ply, facing and adhesive input weight.'); e.statusCode = 400; throw e;
    }
    const sourceRemainingCount = source.sheetCount - used;
    const facingRemainingCount = facing.remainingSheets - facingUsed;
    const sourceRemainingWeight = Math.max(0, Number((sourceWeight - sourceUsedKg).toFixed(3)));
    const facingRemainingWeight = Math.max(0, Number((facingWeight - facingUsedKg).toFixed(3)));
    source.sheetCount = sourceRemainingCount;
    source.totalWeightKg = dec(sourceRemainingWeight);
    if (!sourceRemainingCount) source.status = 'consumed';
    await source.save({ session });
    facing.remainingSheets = facingRemainingCount;
    facing.remainingWeightKg = dec(facingRemainingWeight);
    facing.status = facingRemainingCount === 0 ? 'consumed' : 'partial';
    await facing.save({ session });

    const sourceRate = source.costingStatus === 'available' ? num(source.unitCostPerKg) : 0;
    const facingRate = num(facing.ratePerKg);
    const materialCost = Number((sourceUsedKg * sourceRate + facingUsedKg * facingRate).toFixed(2));
    const costableWeight = outKg > 0 ? outKg : 1;
    const unitCost = Number((materialCost / costableWeight).toFixed(6));
    const existing = await PastingRun.countDocuments().session(session);
    const seq = await Sequence.findOneAndUpdate({ _id: 'pasting-run' },
      [{ $set: { value: { $add: [{ $max: [{ $ifNull: ['$value', existing] }, existing] }, 1] } } }],
      { new: true, upsert: true, session, updatePipeline: true });
    const runNumber = 'PS-' + String(seq.value).padStart(6, '0');
    const [run] = await PastingRun.create([{
      runNumber, runDate: date, operatorName: String(operatorName).trim(), machineName: String(machineName).trim(),
      sourceSheetId: source._id, facingBatchId: facing._id, sheetsConsumed: used, facingSheetsConsumed: facingUsed,
      outputSheetCount: outCount, outputWeightKg: dec(outKg), facingWeightKg: dec(facingUsedKg),
      adhesiveWeightKg: dec(glueKg), wasteWeightKg: dec(wasteKg), materialCost: dec(materialCost),
      unitCostPerKg: dec(unitCost), notes: String(notes).trim(), recordedBy: req.user._id
    }], { session });
    const [output] = await CorrugatedSheet.create([{
      pastingRunId: run._id, ply: 3, lengthInches: source.lengthInches, widthInches: source.widthInches,
      sheetCount: outCount, totalWeightKg: dec(outKg), unitCostPerKg: dec(unitCost),
      costingStatus: source.costingStatus === 'available' ? 'available' : 'unavailable', status: 'available'
    }], { session });
    run.outputSheetId = output._id;
    await run.save({ session });
    await StockMovement.create([
      { movementDate: date, movementType: 'sheet_pasting', referenceId: source._id, referenceModel: 'CorrugatedSheet', itemType: 'sheet', specificationSummary: '2-ply ' + source.lengthInches + 'x' + source.widthInches, quantityChange: -used, weightChangeKg: dec(-sourceUsedKg), notes: 'Issued to pasting ' + runNumber, performedBy: req.user._id },
      { movementDate: date, movementType: 'sheet_pasting', referenceId: facing._id, referenceModel: 'FacingMaterialBatch', itemType: 'facing_material', specificationSummary: facing.materialType + ' ' + facing.lengthInches + 'x' + facing.widthInches, quantityChange: -facingUsed, weightChangeKg: dec(-facingUsedKg), notes: 'Issued to pasting ' + runNumber, performedBy: req.user._id },
      { movementDate: date, movementType: 'sheet_pasting', referenceId: output._id, referenceModel: 'CorrugatedSheet', itemType: 'sheet', specificationSummary: '3-ply ' + output.lengthInches + 'x' + output.widthInches, quantityChange: outCount, weightChangeKg: dec(outKg), notes: 'Produced by pasting ' + runNumber, performedBy: req.user._id }
    ], { session, ordered: true });
    await writeAuditLog(req, { action: 'pasting.recorded', entityType: 'PastingRun', entityId: run._id, entityLabel: runNumber, summary: 'Pasting run ' + runNumber + ' produced ' + outCount + ' 3-ply sheets.', metadata: { sourceUsedKg, facingUsedKg, materialCost, unitCost, wasteKg } }, session);
    await session.commitTransaction();
    return res.status(201).json({ message: 'Sheet pasting recorded.', run, outputSheet: output });
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Pasting failed; no stock changes were committed.' });
  } finally { await session.endSession(); }
};

exports.getPastingRuns = async (req, res) => {
  const runs = await PastingRun.find().populate('sourceSheetId', 'ply lengthInches widthInches').populate('facingBatchId', 'batchNumber materialType').sort({ runDate: -1 }).limit(500).lean();
  return res.json({ runs });
};
