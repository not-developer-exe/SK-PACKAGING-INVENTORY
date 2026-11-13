const mongoose = require('mongoose');
const ProductionRun = require('../models/ProductionRun.model');
const CorrugatedSheet = require('../models/CorrugatedSheet.model');
const ReelUnit = require('../models/ReelUnit.model');
const StockMovement = require('../models/StockMovement.model');

exports.recordProduction = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { shift, operatorName, inputReels, outputSheets } = req.body;

    if (!inputReels?.length || !outputSheets?.length) {
      return res.status(400).json({ message: 'Both input reels and output sheets are required.' });
    }

    const count = await ProductionRun.countDocuments();
    const runNumber = `PR-${String(count + 1).padStart(5, '0')}`;

    let totalInputWeightKg = 0;
    let totalOutputWeightKg = 0;

    for (const input of inputReels) {
      const consumedWeight = parseFloat(input.weightConsumedKg);
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
        itemType: 'reel',
        specificationSummary: `Reel ${reel.reelCode} consumed for ${runNumber}`,
        quantityChange: newWeight <= 2 ? -1 : 0,
        weightChangeKg: -consumedWeight,
        notes: `Issued to Production Run ${runNumber}`,
        performedBy: req.user._id
      }], { session, ordered: true });
    }

    for (const output of outputSheets) {
      totalOutputWeightKg += parseFloat(output.totalWeightKg);
    }
    const wasteGeneratedKg = totalInputWeightKg - totalOutputWeightKg;

    // ADDED ordered: true
    const run = await ProductionRun.create([{
      runNumber,
      shift,
      operatorName,
      inputReels,
      totalInputWeightKg,
      totalOutputWeightKg,
      wasteGeneratedKg,
      status: 'completed',
      recordedBy: req.user._id
    }], { session, ordered: true });

    const productionRunId = run[0]._id;

    for (const output of outputSheets) {
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
        itemType: 'sheet',
        specificationSummary: `${output.ply}Ply | ${output.lengthInches}"x${output.widthInches}"`,
        quantityChange: output.sheetCount,
        weightChangeKg: output.totalWeightKg,
        notes: `Produced from Run ${runNumber}`,
        performedBy: req.user._id
      }], { session, ordered: true });
    }

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ message: 'Production run recorded successfully', runNumber, wasteGeneratedKg });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('[PRODUCTION ERROR]', error);
    res.status(500).json({ message: error.message || 'Error recording production' });
  }
};