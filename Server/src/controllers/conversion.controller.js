const mongoose = require('mongoose');
const CorrugatedSheet = require('../models/CorrugatedSheet.model');
const FinishedBox = require('../models/FinishedBox.model');
const StockMovement = require('../models/StockMovement.model');

exports.recordConversion = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { sheetId, sheetsConsumed, customerId, itemName, dimensions, boxesProduced } = req.body;

    if (!sheetId || !sheetsConsumed || !customerId || !boxesProduced) {
      return res.status(400).json({ message: 'Missing required conversion parameters.' });
    }

    const sheet = await CorrugatedSheet.findById(sheetId).session(session);
    if (!sheet) throw new Error('Source corrugated sheet not found.');
    
    if (sheet.sheetCount < sheetsConsumed) {
      throw new Error(`Insufficient sheets. Available: ${sheet.sheetCount}, Requested: ${sheetsConsumed}`);
    }

    sheet.sheetCount -= sheetsConsumed;
    if (sheet.sheetCount === 0) sheet.status = 'consumed';
    
    const weightPerSheet = parseFloat(sheet.totalWeightKg) / (sheet.sheetCount + sheetsConsumed);
    const weightConsumed = weightPerSheet * sheetsConsumed;
    sheet.totalWeightKg = parseFloat(sheet.totalWeightKg) - weightConsumed;
    
    await sheet.save({ session });

    const count = await FinishedBox.countDocuments();
    const batchNumber = `FB-${String(count + 1).padStart(6, '0')}`;

    // ADDED ordered: true
    const box = await FinishedBox.create([{
      batchNumber,
      customerId,
      itemName,
      ply: sheet.ply,
      dimensions,
      sourceSheetId: sheet._id,
      quantityProduced: boxesProduced,
      quantityAvailable: boxesProduced,
      recordedBy: req.user._id
    }], { session, ordered: true }); 

    // ADDED ordered: true
    await StockMovement.create([{
      movementType: 'production_issue',
      referenceId: sheet._id,
      itemType: 'sheet',
      specificationSummary: `${sheet.ply}Ply | Consumed for Box Batch ${batchNumber}`,
      quantityChange: -sheetsConsumed,
      weightChangeKg: -weightConsumed,
      notes: `Converted into ${boxesProduced} boxes`,
      performedBy: req.user._id
    },
    {
      movementType: 'adjustment',
      referenceId: box[0]._id,
      itemType: 'finished_good',
      specificationSummary: `${itemName} | ${dimensions.length}x${dimensions.width}x${dimensions.height}`,
      quantityChange: boxesProduced,
      weightChangeKg: weightConsumed, 
      notes: `Manufactured from Sheet ${sheet._id}`,
      performedBy: req.user._id
    }], { session, ordered: true });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ message: 'Box conversion successful', batchNumber, box: box[0] });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('[CONVERSION ERROR]', error);
    res.status(500).json({ message: error.message || 'Error recording conversion' });
  }
};

exports.getAvailableSheets = async (req, res) => {
  try {
    const sheets = await CorrugatedSheet.find({ status: 'available' }).sort({ createdAt: 1 });
    res.json({ sheets });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching sheets', error: error.message });
  }
};