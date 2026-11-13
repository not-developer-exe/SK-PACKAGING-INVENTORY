const mongoose = require('mongoose');
const Dispatch = require('../models/Dispatch.model');
const FinishedBox = require('../models/FinishedBox.model');
const StockMovement = require('../models/StockMovement.model');

exports.recordDispatch = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { customerId, vehicleNumber, driverName, boxes } = req.body;

    if (!customerId || !boxes?.length) {
      return res.status(400).json({ message: 'Customer and at least one box batch are required.' });
    }

    // 1. Generate Challan Number
    const count = await Dispatch.countDocuments();
    const challanNumber = `DC-${String(count + 1).padStart(6, '0')}`;

    // 2. Process each box batch being dispatched
    for (const item of boxes) {
      const dispatchQty = parseInt(item.dispatchQuantity, 10);
      
      const box = await FinishedBox.findById(item.boxId).session(session);
      if (!box) throw new Error(`Box batch ${item.boxId} not found.`);

      if (box.quantityAvailable < dispatchQty) {
        throw new Error(`Insufficient stock for ${box.itemName}. Available: ${box.quantityAvailable}, Requested: ${dispatchQty}`);
      }

      // Deduct inventory
      box.quantityAvailable -= dispatchQty;
      if (box.quantityAvailable === 0) box.status = 'dispatched';
      await box.save({ session });

      // Ledger Entry
      await StockMovement.create([{
        movementType: 'dispatch',
        referenceId: box._id,
        itemType: 'finished_good',
        specificationSummary: `${box.itemName} | ${box.dimensions.length}x${box.dimensions.width}x${box.dimensions.height}`,
        quantityChange: -dispatchQty,
        weightChangeKg: 0, // Finished goods dispatch usually tracks counts, not raw paper weight
        notes: `Dispatched via Challan ${challanNumber}`,
        performedBy: req.user._id
      }], { session, ordered: true });
    }

    // 3. Create the Delivery Challan Header
    const dispatch = await Dispatch.create([{
      challanNumber,
      customerId,
      vehicleNumber,
      driverName,
      boxes
    }], { session, ordered: true });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ message: 'Dispatch recorded successfully', challanNumber });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('[DISPATCH ERROR]', error);
    res.status(500).json({ message: error.message || 'Error recording dispatch' });
  }
};

// Helper: Fetch boxes that are currently sitting in the warehouse
exports.getAvailableBoxes = async (req, res) => {
  try {
    const boxes = await FinishedBox.find({ quantityAvailable: { $gt: 0 } })
      .populate('customerId', 'name')
      .sort({ createdAt: 1 });
    res.json({ boxes });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching available boxes', error: error.message });
  }
};

exports.getDispatches = async (req, res) => {
    try {
      const dispatches = await Dispatch.find()
        .populate('customerId', 'name')
        .populate('boxes.boxId', 'batchNumber itemName dimensions')
        .sort({ createdAt: -1 }); // Newest first
      res.json({ dispatches });
    } catch (error) {
      res.status(500).json({ message: 'Error fetching dispatches', error: error.message });
    }
  };