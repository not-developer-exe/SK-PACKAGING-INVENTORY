const mongoose = require('mongoose');
const ProductionRun = require('../models/ProductionRun.model');
const CorrugatedSheet = require('../models/CorrugatedSheet.model');
const ReelUnit = require('../models/ReelUnit.model');
const StockMovement = require('../models/StockMovement.model');
const Sequence = require('../models/Sequence.model');

exports.recordProduction = async (req, res) => {
  const { shift, operatorName, inputReels, outputSheets } = req.body || {};

  if (!Array.isArray(inputReels) || inputReels.length === 0 || !Array.isArray(outputSheets) || outputSheets.length === 0) {
    return res.status(400).json({ message: 'Both input reels and output sheets are required.' });
  }

  const inputs = inputReels.map((item) => ({ ...item, weightConsumedKg: Number(item.weightConsumedKg) }));
  const outputs = outputSheets.map((item) => ({
    ...item,
    totalWeightKg: Number(item.totalWeightKg),
    sheetCount: Number(item.sheetCount),
    lengthInches: Number(item.lengthInches),
    widthInches: Number(item.widthInches)
  }));

  if (inputs.some((item) => !mongoose.isValidObjectId(item.reelId) || !Number.isFinite(item.weightConsumedKg) || item.weightConsumedKg <= 0)) {
    return res.status(400).json({ message: 'Every input reel must have a valid ID and a positive consumed weight.' });
  }
  if (outputs.some((item) => !Number.isFinite(item.totalWeightKg) || item.totalWeightKg <= 0 || !Number.isInteger(item.sheetCount) || item.sheetCount <= 0 || !Number.isFinite(item.lengthInches) || item.lengthInches <= 0 || !Number.isFinite(item.widthInches) || item.widthInches <= 0)) {
    return res.status(400).json({ message: 'Every output line must have positive dimensions, weight and a whole-number sheet count.' });
  }
  const totalInputWeight = inputs.reduce((sum, item) => sum + item.weightConsumedKg, 0);
  const totalOutputWeight = outputs.reduce((sum, item) => sum + item.totalWeightKg, 0);
  if (totalOutputWeight > totalInputWeight) {
    return res.status(400).json({ message: 'Output sheet weight cannot exceed total input reel weight.' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {

    const existingCount = await ProductionRun.countDocuments().session(session);
    const sequence = await Sequence.findOneAndUpdate(
      { _id: 'production-run' },
      [{ $set: { value: { $add: [{ $max: [{ $ifNull: ['$value', existingCount] }, existingCount] }, 1] } }],
      { new: true, upsert: true, session }
    );
    const runNumber = `PR-${String(sequence.value).padStart(5, '0')}`;

    let totalInputWeightKg = 0;
    let totalOutputWeightKg = 0;

    for (const input of inputs) {
      const consumedWeight = input.weightConsumedKg;
      totalInputWeightKg += consumedWeight;

      const reel = await ReelUnit.findById(input.reelId).session(session);
      if (!reel) throw new Error(`Reel ${input.reelId} not found.`);

      const currentWeight = parseFloat(reel.remainingWeightKg.toString());
      if (currentWeight < consumedWeight) {
        throw new Error(`Insufficient weight in Reel ${reel.reelCode}. Available: ${currentWeight}kg, Requested: ${consumedWeight}kg`);
      }

      const newWeight = currentWeight - consumedWeight;
      reel.remainingWeightKg = newWeight;
      reel.status = newWeight <= 2 ? 'consumed' : 'partial';
      await reel.save({ session });

      // ADDED ordered: true
      await StockMovement.create([{
        movementType: 'production_issue',
        referenceId: reel._id,
        referenceModel: 'ReelUnit',
        itemType: 'reel',
        specificationSummary: `Reel ${reel.reelCode} consumed for ${runNumber}`,
        quantityChange: newWeight <= 2 ? -1 : 0,
        weightChangeKg: -consumedWeight,
        notes: `Issued to Production Run ${runNumber}`,
        performedBy: req.user._id
      }], { session, ordered: true });
    }

    for (const output of outputs) {
      totalOutputWeightKg += output.totalWeightKg;
    }
    const wasteGeneratedKg = totalInputWeightKg - totalOutputWeightKg;

    // ADDED ordered: true
    const run = await ProductionRun.create([{
      runNumber,
      shift,
      operatorName,
      inputReels: inputs,
      totalInputWeightKg,
      totalOutputWeightKg,
      wasteGeneratedKg,
      status: 'completed',
      recordedBy: req.user._id
    }], { session, ordered: true });

    const productionRunId = run[0]._id;

    for (const output of outputs) {
      // ADDED ordered: true
      const sheet = await CorrugatedSheet.create([{
        productionRunId,
        ply: output.ply,
        lengthInches: output.lengthInches,
        widthInches: output.widthInches,
        sheetCount: output.sheetCount,
        totalWeightKg: output.totalWeightKg,
        status: 'available'
      }], { session, ordered: true });

      // ADDED ordered: true
      await StockMovement.create([{
        movementType: 'sheet_cutting',
        referenceId: sheet[0]._id,
        referenceModel: 'CorrugatedSheet',
        itemType: 'sheet',
        specificationSummary: `${output.ply}Ply | ${output.lengthInches}"x${output.widthInches}"`,
        quantityChange: output.sheetCount,
        weightChangeKg: output.totalWeightKg,
        notes: `Produced from Run ${runNumber}`,
        performedBy: req.user._id
      }], { session, ordered: true });
    }

    await session.commitTransaction();

    res.status(201).json({ message: 'Production run recorded successfully', runNumber, wasteGeneratedKg });
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    console.error('[PRODUCTION ERROR]', error.message);
    res.status(error.statusCode || (error.name === 'ValidationError' ? 400 : 500)).json({ message: error.message || 'Error recording production' });
  } finally {
    await session.endSession();
  }
};