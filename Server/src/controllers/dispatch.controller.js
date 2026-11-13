const mongoose = require('mongoose');
const Dispatch = require('../models/Dispatch.model');
const FinishedBox = require('../models/FinishedBox.model');
const StockMovement = require('../models/StockMovement.model');
const Party = require('../models/Party.model');
const Sequence = require('../models/Sequence.model');

exports.recordDispatch = async (req, res) => {
  const { customerId, vehicleNumber, driverName, boxes } = req.body || {};
  if (!mongoose.isValidObjectId(customerId) || !Array.isArray(boxes) || boxes.length === 0) {
    return res.status(400).json({ message: 'A valid customer and at least one box batch are required' });
  }

  const quantities = new Map();
  for (const item of boxes) {
    const id = String(item.boxId || '');
    const quantity = Number(item.dispatchQuantity);
    if (!mongoose.isValidObjectId(id) || !Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ message: 'Each dispatch line must contain a valid batch and a positive whole-number quantity' });
    }
    quantities.set(id, (quantities.get(id) || 0) + quantity);
  }

  const session = await mongoose.startSession();
  let challanNumber;
  try {
    await session.withTransaction(async () => {
      const customer = await Party.findById(customerId).session(session);
      if (!customer || !['Customer', 'Both'].includes(customer.type)) {
        const error = new Error('Selected party is not a valid customer');
        error.statusCode = 400;
        throw error;
      }

      const existingCount = await Dispatch.countDocuments().session(session);
      const sequence = await Sequence.findOneAndUpdate(
        { _id: 'dispatch-challan' },
        { $max: { value: existingCount }, $inc: { value: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true, session }
      );
      challanNumber = `DC-${String(sequence.value).padStart(6, '0')}`;

      const dispatchLines = [];
      for (const [boxId, dispatchQuantity] of quantities) {
        const box = await FinishedBox.findById(boxId).session(session);
        if (!box) {
          const error = new Error(`Finished goods batch ${boxId} was not found`);
          error.statusCode = 404;
          throw error;
        }
        if (String(box.customerId) !== String(customerId)) {
          const error = new Error(`Batch ${box.batchNumber} is assigned to a different customer`);
          error.statusCode = 400;
          throw error;
        }
        if (box.quantityAvailable < dispatchQuantity) {
          const error = new Error(`Insufficient stock for ${box.itemName}. Available: ${box.quantityAvailable}, requested: ${dispatchQuantity}`);
          error.statusCode = 409;
          throw error;
        }

        box.quantityAvailable -= dispatchQuantity;
        if (box.quantityAvailable === 0) box.status = 'dispatched';
        await box.save({ session });

        await StockMovement.create([{
          movementType: 'dispatch',
          referenceId: box._id,
          referenceModel: 'FinishedBox',
          itemType: 'finished_good',
          specificationSummary: `${box.itemName} | ${box.dimensions.length}x${box.dimensions.width}x${box.dimensions.height}`,
          quantityChange: -dispatchQuantity,
          weightChangeKg: 0,
          notes: `Dispatched via Challan ${challanNumber}`,
          performedBy: req.user._id
        }], { session });

        dispatchLines.push({ boxId: box._id, dispatchQuantity });
      }

      await Dispatch.create([{
        challanNumber,
        customerId,
        vehicleNumber: typeof vehicleNumber === 'string' ? vehicleNumber.trim() : '',
        driverName: typeof driverName === 'string' ? driverName.trim() : '',
        boxes: dispatchLines,
        recordedBy: req.user._id
      }], { session });
    });

    return res.status(201).json({ message: 'Dispatch recorded successfully', challanNumber });
  } catch (error) {
    console.error('[DISPATCH ERROR]', error.message);
    const status = error.statusCode || (error.code === 11000 ? 409 : 500);
    return res.status(status).json({
      message: status >= 500 ? 'Unable to record dispatch. No stock changes were committed.' : error.message
    });
  } finally {
    await session.endSession();
  }
};

exports.getAvailableBoxes = async (req, res) => {
  try {
    const boxes = await FinishedBox.find({ quantityAvailable: { $gt: 0 } })
      .populate('customerId', 'name')
      .sort({ createdAt: 1 })
      .lean();
    return res.json({ boxes });
  } catch (error) {
    console.error('[DISPATCH] Available stock query failed:', error.message);
    return res.status(500).json({ message: 'Unable to fetch available finished goods' });
  }
};

exports.getDispatches = async (req, res) => {
  try {
    const dispatches = await Dispatch.find()
      .populate('customerId', 'name')
      .populate('boxes.boxId', 'batchNumber itemName dimensions')
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ dispatches });
  } catch (error) {
    console.error('[DISPATCH] Dispatch history query failed:', error.message);
    return res.status(500).json({ message: 'Unable to fetch dispatch history' });
  }
};
