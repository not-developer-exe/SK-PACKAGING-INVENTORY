const mongoose = require('mongoose');
const Dispatch = require('../models/Dispatch.model');
const FinishedBox = require('../models/FinishedBox.model');
const StockMovement = require('../models/StockMovement.model');
const Party = require('../models/Party.model');
const Invoice = require('../models/Invoice.model');
const Sequence = require('../models/Sequence.model');
const writeAuditLog = require('../utils/writeAuditLog');
const { buildDateRangeFilter, isValidDateOnly } = require('../utils/dateFilters');

exports.recordDispatch = async (req, res) => {
  const { customerId, vehicleNumber, driverName, boxes, dispatchDate } = req.body || {};
  if (dispatchDate !== undefined && !isValidDateOnly(dispatchDate)) {
    return res.status(400).json({ message: 'Dispatch date must be a real calendar date in YYYY-MM-DD format.' });
  }
  const parsedDispatchDate = dispatchDate ? new Date(dispatchDate + 'T00:00:00+05:30') : new Date();
  if (!mongoose.isValidObjectId(customerId) || !Array.isArray(boxes) || boxes.length === 0) {
    return res.status(400).json({ message: 'A valid customer and at least one box batch are required' });
  }

  const quantities = new Map();
  for (const item of boxes) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return res.status(400).json({ message: 'Each dispatch line must be a valid object.' });
    }
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
      if (!customer || customer.isActive === false || !['Customer', 'Both'].includes(customer.type)) {
        const error = new Error('Selected party is not a valid customer');
        error.statusCode = 400;
        throw error;
      }

      const existingCount = await Dispatch.countDocuments().session(session);
      const sequence = await Sequence.findOneAndUpdate(
        { _id: 'dispatch-challan' },
        [{ $set: { value: { $add: [{ $max: [{ $ifNull: ['$value', existingCount] }, existingCount] }, 1] } } }],
        { new: true, upsert: true, session, updatePipeline: true }
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
        if (box.qualityStatus !== 'approved') {
          const error = new Error(`Batch ${box.batchNumber} has not passed finished-goods quality inspection.`);
          error.statusCode = 409;
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
          movementDate: parsedDispatchDate,
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

      const [dispatch] = await Dispatch.create([{
        challanNumber,
        customerId,
        dispatchDate: parsedDispatchDate,
        vehicleNumber: typeof vehicleNumber === 'string' ? vehicleNumber.trim() : '',
        driverName: typeof driverName === 'string' ? driverName.trim() : '',
        boxes: dispatchLines,
        recordedBy: req.user._id
      }], { session });
      await writeAuditLog(req, { action: 'dispatch.recorded', entityType: 'Dispatch', entityId: dispatch._id, entityLabel: challanNumber, summary: 'Dispatch recorded: ' + challanNumber, metadata: { customerId: String(customerId), batchCount: dispatchLines.length, boxes: dispatchLines } }, session);
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


exports.cancelDispatch = async (req, res) => {
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (reason.length < 10 || reason.length > 500) {
    return res.status(400).json({ message: 'Enter a cancellation reason between 10 and 500 characters.' });
  }
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid dispatch ID.' });
  }

  const session = await mongoose.startSession();
  try {
    let cancelled;
    await session.withTransaction(async () => {
      const dispatch = await Dispatch.findById(req.params.id).session(session);
      if (!dispatch) throw Object.assign(new Error('Dispatch not found.'), { statusCode: 404 });
      if (dispatch.status === 'cancelled') {
        throw Object.assign(new Error('This dispatch is already cancelled.'), { statusCode: 409 });
      }
      if (dispatch.status === 'delivered') {
        throw Object.assign(new Error('A delivered dispatch cannot be cancelled. Use a return/credit workflow.'), { statusCode: 409 });
      }
      const linkedInvoice = await Invoice.findOne({
        dispatchId: dispatch._id,
        status: { $ne: 'Cancelled' }
      }).session(session);
      if (linkedInvoice) {
        throw Object.assign(new Error('This challan is linked to invoice ' + linkedInvoice.invoiceNumber + '. Cancel or credit the invoice through the accounting workflow before cancelling dispatch.'), { statusCode: 409 });
      }

      for (const line of dispatch.boxes) {
        const box = await FinishedBox.findById(line.boxId).session(session);
        if (!box) {
          throw Object.assign(new Error('A finished-goods batch linked to this challan no longer exists. No changes were committed.'), { statusCode: 409 });
        }
        box.quantityAvailable += line.dispatchQuantity;
        if (box.quantityAvailable > 0) box.status = 'available';
        await box.save({ session });
        await StockMovement.create([{
          movementDate: new Date(),
          movementType: 'adjustment',
          referenceId: dispatch._id,
          referenceModel: 'Dispatch',
          itemType: 'finished_good',
          specificationSummary: box.itemName + ' | ' + box.dimensions.length + 'x' + box.dimensions.width + 'x' + box.dimensions.height,
          quantityChange: line.dispatchQuantity,
          weightChangeKg: 0,
          notes: 'Stock restored after cancellation of ' + dispatch.challanNumber + ': ' + reason,
          performedBy: req.user._id
        }], { session });
      }

      dispatch.status = 'cancelled';
      dispatch.cancelledAt = new Date();
      dispatch.cancelledBy = req.user._id;
      dispatch.cancellationReason = reason;
      await dispatch.save({ session });
      await writeAuditLog(req, {
        action: 'dispatch.cancelled',
        entityType: 'Dispatch',
        entityId: dispatch._id,
        entityLabel: dispatch.challanNumber,
        summary: 'Dispatch cancelled: ' + dispatch.challanNumber,
        metadata: { reason, restoredLines: dispatch.boxes.map(line => ({ boxId: String(line.boxId), quantity: line.dispatchQuantity })) }
      }, session);
      cancelled = dispatch;
    });
    return res.json({ message: 'Dispatch cancelled and finished-goods stock restored.', dispatch: cancelled });
  } catch (error) {
    console.error('[DISPATCH] Cancellation failed:', error.message);
    return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Unable to cancel dispatch. No stock changes were committed.' });
  } finally {
    await session.endSession();
  }
};


exports.markDelivered = async (req, res) => {
  const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : '';
  if (notes.length < 3 || notes.length > 500) return res.status(400).json({ message: 'Enter delivery confirmation or proof reference (3–500 characters).' });
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid dispatch ID.' });
  const session = await mongoose.startSession();
  try {
    let delivered;
    await session.withTransaction(async () => {
      const dispatch = await Dispatch.findById(req.params.id).session(session);
      if (!dispatch) throw Object.assign(new Error('Dispatch not found.'), { statusCode: 404 });
      if (dispatch.status === 'cancelled') throw Object.assign(new Error('A cancelled dispatch cannot be marked delivered.'), { statusCode: 409 });
      if (dispatch.status === 'delivered') throw Object.assign(new Error('This dispatch is already marked delivered.'), { statusCode: 409 });
      dispatch.status = 'delivered';
      dispatch.deliveredAt = new Date();
      dispatch.deliveredBy = req.user._id;
      dispatch.deliveryNotes = notes;
      await dispatch.save({ session });
      await writeAuditLog(req, {
        action: 'dispatch.delivered',
        entityType: 'Dispatch',
        entityId: dispatch._id,
        entityLabel: dispatch.challanNumber,
        summary: 'Dispatch marked delivered: ' + dispatch.challanNumber,
        metadata: { notes, deliveredAt: dispatch.deliveredAt }
      }, session);
      delivered = dispatch;
    });
    return res.json({ message: 'Delivery confirmed and audited.', dispatch: delivered });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Unable to confirm delivery.' });
  } finally { await session.endSession(); }
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
    const filter = buildDateRangeFilter(req.query.from, req.query.to, 'dispatchDate');
    if (req.query.customerId) {
      if (!mongoose.isValidObjectId(req.query.customerId)) return res.status(400).json({ message: 'Invalid customer ID.' });
      filter.customerId = req.query.customerId;
    }
    const dispatches = await Dispatch.find(filter)
      .populate('customerId', 'name')
      .populate('boxes.boxId', 'batchNumber itemName dimensions')
      .sort({ dispatchDate: -1, createdAt: -1 })
      .lean()
      .limit(1000);
    return res.json({ dispatches });
  } catch (error) {
    console.error('[DISPATCH] Dispatch history query failed:', error.message);
    return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Unable to fetch dispatch history' });
  }
};


exports.updateFinishedGoodsQuality = async (req, res) => {
  const { qualityStatus, qualityNotes = '' } = req.body || {};
  if (!['approved', 'rejected'].includes(qualityStatus)) return res.status(400).json({ message: 'Quality status must be approved or rejected.' });
  if (typeof qualityNotes !== 'string' || qualityNotes.trim().length > 500) return res.status(400).json({ message: 'Quality notes must be 500 characters or fewer.' });
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid finished-goods batch ID.' });
  try {
    const box = await FinishedBox.findOne({ _id: req.params.id });
    if (!box) return res.status(404).json({ message: 'Finished-goods batch not found.' });
    if (box.status === 'dispatched' || box.quantityAvailable !== box.quantityProduced) return res.status(409).json({ message: 'Quality status cannot be changed after any quantity has been dispatched.' });
    box.qualityStatus = qualityStatus;
    box.qualityNotes = qualityNotes.trim();
    box.qualityCheckedAt = new Date();
    box.qualityCheckedBy = req.user._id;
    await box.save();
    await writeAuditLog(req, { action: 'finished_goods.quality_checked', entityType: 'FinishedBox', entityId: box._id, entityLabel: box.batchNumber, summary: 'Finished goods quality marked ' + qualityStatus + ': ' + box.batchNumber, metadata: { qualityStatus, qualityNotes: box.qualityNotes } });
    return res.json({ message: 'Finished-goods quality status updated.', box });
  } catch (error) {
    console.error('[FINISHED GOODS] Quality update failed:', error.message);
    return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Unable to update finished-goods quality status.' });
  }
};
