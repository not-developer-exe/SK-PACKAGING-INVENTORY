const mongoose = require('mongoose');
const CorrugatedSheet = require('../models/CorrugatedSheet.model');
const FinishedBox = require('../models/FinishedBox.model');
const StockMovement = require('../models/StockMovement.model');
const Party = require('../models/Party.model');
const Sequence = require('../models/Sequence.model');
const writeAuditLog = require('../utils/writeAuditLog');
const { calculateSheetConsumption } = require('../utils/sheetConversion');

exports.recordConversion = async (req, res) => {
  const {
    sheetId,
    sheetsConsumed: rawSheetsConsumed,
    customerId,
    itemName,
    dimensions,
    boxesProduced: rawBoxesProduced
  } = req.body || {};

  const sheetsConsumed = Number(rawSheetsConsumed);
  const boxesProduced = Number(rawBoxesProduced);
  if (!mongoose.isValidObjectId(sheetId) || !mongoose.isValidObjectId(customerId)) {
    return res.status(400).json({ message: 'Select a valid sheet batch and customer.' });
  }
  if (!Number.isInteger(sheetsConsumed) || sheetsConsumed <= 0 ||
      !Number.isInteger(boxesProduced) || boxesProduced <= 0) {
    return res.status(400).json({ message: 'Sheets consumed and boxes produced must be positive whole numbers.' });
  }
  if (typeof itemName !== 'string' || itemName.trim().length < 2 ||
      !dimensions || !['length', 'width', 'height'].every((key) =>
        Number.isFinite(Number(dimensions[key])) && Number(dimensions[key]) > 0)) {
    return res.status(400).json({ message: 'Enter an item name and positive box length, width and height.' });
  }

  const session = await mongoose.startSession();
  let response;
  try {
    await session.withTransaction(async () => {
      const [sheet, customer] = await Promise.all([
        CorrugatedSheet.findById(sheetId).session(session),
        Party.findById(customerId).session(session)
      ]);
      if (!sheet || sheet.status !== 'available') {
        const error = new Error('Source sheet batch is unavailable or has already been consumed.');
        error.statusCode = 409;
        throw error;
      }
      if (!customer || customer.isActive === false || !['Customer', 'Both'].includes(customer.type)) {
        const error = new Error('Selected party is not an active customer.');
        error.statusCode = 400;
        throw error;
      }

      let consumption;
      try {
        consumption = calculateSheetConsumption({
          availableSheets: sheet.sheetCount,
          availableWeightKg: Number(sheet.totalWeightKg.toString()),
          sheetsConsumed
        });
      } catch (error) {
        error.statusCode = 409;
        throw error;
      }

      const existingCount = await FinishedBox.countDocuments().session(session);
      const sequence = await Sequence.findOneAndUpdate(
        { _id: 'finished-box-batch' },
        [{ $set: { value: { $add: [{ $max: [{ $ifNull: ['$value', existingCount] }, existingCount] }, 1] } } }],
        { new: true, upsert: true, session }
      );
      const batchNumber = 'FB-' + String(sequence.value).padStart(6, '0');

      const updatedSheet = await CorrugatedSheet.updateOne(
        { _id: sheet._id, status: 'available', sheetCount: { $gte: sheetsConsumed } },
        {
          $inc: { sheetCount: -sheetsConsumed },
          $set: {
            totalWeightKg: mongoose.Types.Decimal128.fromString(String(consumption.remainingWeightKg)),
            status: consumption.remainingSheets === 0 ? 'consumed' : 'available'
          }
        },
        { session }
      );
      if (updatedSheet.modifiedCount !== 1) {
        const error = new Error('Sheet stock changed during conversion. Refresh and try again.');
        error.statusCode = 409;
        throw error;
      }

      const [box] = await FinishedBox.create([{
        batchNumber,
        customerId: customer._id,
        itemName: itemName.trim(),
        ply: sheet.ply,
        dimensions: {
          length: Number(dimensions.length),
          width: Number(dimensions.width),
          height: Number(dimensions.height)
        },
        sourceSheetId: sheet._id,
        quantityProduced: boxesProduced,
        quantityAvailable: boxesProduced,
        recordedBy: req.user._id
      }], { session });

      await StockMovement.create([
        {
          movementType: 'production_issue',
          referenceId: sheet._id,
          referenceModel: 'CorrugatedSheet',
          itemType: 'sheet',
          specificationSummary: sheet.ply + 'Ply | ' + sheet.lengthInches + 'x' + sheet.widthInches,
          quantityChange: -sheetsConsumed,
          weightChangeKg: mongoose.Types.Decimal128.fromString(String(-consumption.consumedWeightKg)),
          notes: 'Consumed for finished-box batch ' + batchNumber,
          performedBy: req.user._id
        },
        {
          movementType: 'adjustment',
          referenceId: box._id,
          referenceModel: 'FinishedBox',
          itemType: 'finished_good',
          specificationSummary: itemName.trim() + ' | ' + dimensions.length + 'x' + dimensions.width + 'x' + dimensions.height,
          quantityChange: boxesProduced,
          weightChangeKg: mongoose.Types.Decimal128.fromString('0'),
          notes: 'Manufactured from sheet batch ' + String(sheet._id),
          performedBy: req.user._id
        }
      ], { session, ordered: true });

      await writeAuditLog(req, {
        action: 'conversion.recorded',
        entityType: 'FinishedBox',
        entityId: box._id,
        entityLabel: batchNumber,
        summary: 'Converted ' + sheetsConsumed + ' sheets into ' + boxesProduced + ' boxes (' + batchNumber + ').',
        metadata: {
          sheetId: String(sheet._id),
          customerId: String(customer._id),
          sheetsConsumed,
          consumedWeightKg: consumption.consumedWeightKg,
          boxesProduced
        }
      }, session);

      response = { batchNumber, box, remainingSheets: consumption.remainingSheets };
    });

    return res.status(201).json({
      message: 'Sheet-to-box conversion recorded. Sheet stock, finished goods and stock ledger updated.',
      ...response
    });
  } catch (error) {
    console.error('[CONVERSION ERROR]', error.message);
    const status = error.statusCode || (error.code === 11000 ? 409 : error.name === 'ValidationError' ? 400 : 500);
    return res.status(status).json({
      message: status >= 500 ? 'Conversion failed. No stock changes were committed.' : error.message
    });
  } finally {
    await session.endSession();
  }
};

exports.getAvailableSheets = async (req, res) => {
  try {
    const sheets = await CorrugatedSheet.find({ status: 'available', sheetCount: { $gt: 0 } })
      .sort({ createdAt: 1 })
      .lean();
    return res.json({ sheets });
  } catch (error) {
    console.error('[CONVERSION] Sheet query failed:', error.message);
    return res.status(500).json({ message: 'Unable to fetch available sheet stock.' });
  }
};
