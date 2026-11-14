const mongoose = require('mongoose');
const CorrugatedSheet = require('../models/CorrugatedSheet.model');
const FinishedBox = require('../models/FinishedBox.model');
const StockMovement = require('../models/StockMovement.model');
const Party = require('../models/Party.model');
const Sequence = require('../models/Sequence.model');
const writeAuditLog = require('../utils/writeAuditLog');
const { calculateSheetConsumption } = require('../utils/sheetConversion');
const { calculateMaterialCost } = require('../utils/materialCosting');
const { buildDateRangeFilter, isValidDateOnly } = require('../utils/dateFilters');

exports.recordConversion = async (req, res) => {
  const {
    sheetId,
    sheetsConsumed: rawSheetsConsumed,
    customerId,
    itemName,
    dimensions,
    boxesProduced: rawBoxesProduced,
    conversionDate: rawConversionDate
  } = req.body || {};

  if (rawConversionDate !== undefined && !isValidDateOnly(rawConversionDate)) {
    return res.status(400).json({ message: 'Conversion date must be a real calendar date in YYYY-MM-DD format.' });
  }
  const conversionDate = rawConversionDate ? new Date(rawConversionDate + 'T00:00:00+05:30') : new Date();
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
        { new: true, upsert: true, session, updatePipeline: true }
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

      const unitCostPerKg = Number(sheet.unitCostPerKg?.toString() || 0);
      const costingStatus = sheet.costingStatus === 'available' ? 'available' : 'unavailable';
      const materialCost = costingStatus === 'available'
        ? calculateMaterialCost(consumption.consumedWeightKg, unitCostPerKg)
        : 0;
      const costPerBox = boxesProduced > 0 ? Number((materialCost / boxesProduced).toFixed(2)) : 0;

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
        manufacturedAt: conversionDate,
        quantityProduced: boxesProduced,
        quantityAvailable: boxesProduced,
        materialCost,
        costPerBox,
        costingStatus,
        recordedBy: req.user._id
      }], { session });

      await StockMovement.create([
        {
          movementDate: conversionDate,
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
          movementDate: conversionDate,
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
          boxesProduced,
          materialCost,
          costPerBox,
          costingStatus
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

exports.getFinishedGoods = async (req, res) => {
  try {
    const filter = buildDateRangeFilter(req.query.from, req.query.to, 'manufacturedAt');
    if (req.query.customerId) {
      if (!mongoose.isValidObjectId(req.query.customerId)) return res.status(400).json({ message: 'Invalid customer ID.' });
      filter.customerId = req.query.customerId;
    }
    const finishedGoods = await FinishedBox.find(filter)
      .populate('customerId', 'name')
      .populate('sourceSheetId', 'ply lengthInches widthInches')
      .sort({ manufacturedAt: -1, createdAt: -1 })
      .limit(1000)
      .lean();
    return res.json({ finishedGoods });
  } catch (error) {
    console.error('[CONVERSION] Finished goods history query failed:', error.message);
    return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Unable to fetch finished goods history.' });
  }
};
