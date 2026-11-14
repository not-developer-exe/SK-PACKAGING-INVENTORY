const mongoose = require('mongoose');
const crypto = require('crypto');
const Invoice = require('../models/Invoice.model');
const Dispatch = require('../models/Dispatch.model');
const Party = require('../models/Party.model');
const FinishedBox = require('../models/FinishedBox.model');
const writeAuditLog = require('../utils/writeAuditLog');
const { buildDateRangeFilter, isValidDateOnly } = require('../utils/dateFilters');

exports.getInvoices = async (req, res) => {
  try {
    const filter = buildDateRangeFilter(req.query.from, req.query.to, 'invoiceDate');
    if (req.query.customerId) {
      if (!mongoose.isValidObjectId(req.query.customerId)) return res.status(400).json({ message: 'Invalid customer ID.' });
      filter.customerId = req.query.customerId;
    }
    if (req.query.status && !['Paid', 'Pending', 'Overdue', 'Cancelled'].includes(req.query.status)) return res.status(400).json({ message: 'Invalid invoice status.' });
    if (req.query.status) filter.status = req.query.status;
    const invoices = await Invoice.find(filter)
      .populate('customerId', 'name')
      .populate('dispatchId', 'challanNumber dispatchDate')
      .sort({ invoiceDate: -1, createdAt: -1 })
      .limit(1000)
      .lean();
    return res.json({ invoices });
  } catch (error) {
    console.error('[INVOICE] List failed:', error.message);
    return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Unable to fetch invoices.' });
  }
};

exports.getUninvoicedDispatches = async (req, res) => {
  try {
    const { customerId } = req.params;
    if (!mongoose.isValidObjectId(customerId)) {
      return res.status(400).json({ message: 'Invalid customer ID' });
    }

    const [dispatches, billed] = await Promise.all([
      Dispatch.find({ customerId }).populate('boxes.boxId').sort({ createdAt: -1 }).lean(),
      Invoice.find({ customerId }).select('dispatchId').lean()
    ]);
    const billedIds = new Set(billed.map((invoice) => String(invoice.dispatchId)));
    return res.json(dispatches.filter((dispatch) => !billedIds.has(String(dispatch._id))));
  } catch (error) {
    console.error('[INVOICE] Unable to list unbilled challans:', error.message);
    return res.status(500).json({ message: 'Unable to fetch unbilled delivery challans' });
  }
};

exports.createInvoice = async (req, res) => {
  const session = await mongoose.startSession();
  let createdInvoice;

  try {
    const {
      invoiceDate,
      customerId,
      dispatchId,
      items,
      gstPercent
    } = req.body || {};

    if (![customerId, dispatchId].every(mongoose.isValidObjectId)) {
      return res.status(400).json({ message: 'A valid customer and delivery challan are required' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'At least one invoice line is required' });
    }

    if (!isValidDateOnly(invoiceDate)) {
      return res.status(400).json({ message: 'Invoice date must be a real calendar date in YYYY-MM-DD format.' });
    }
    const date = new Date(invoiceDate + 'T00:00:00+05:30');
    const gst = Number(gstPercent);
    if (!Number.isFinite(gst) || gst < 0 || gst > 40) {
      return res.status(400).json({ message: 'Invoice date or GST rate is invalid' });
    }

    const cleanItems = items.map((item) => ({
      boxId: item.boxId,
      quantity: Number(item.quantity),
      rate: Number(item.rate)
    }));
    if (cleanItems.some((item) =>
      !mongoose.isValidObjectId(item.boxId) ||
      !Number.isInteger(item.quantity) || item.quantity <= 0 ||
      !Number.isFinite(item.rate) || item.rate < 0
    )) {
      return res.status(400).json({ message: 'Invoice lines contain invalid box, quantity or rate values' });
    }

    await session.withTransaction(async () => {
      const [customer, dispatch, existingInvoice] = await Promise.all([
        Party.findById(customerId).session(session),
        Dispatch.findOne({ _id: dispatchId, customerId }).session(session),
        Invoice.findOne({ dispatchId }).session(session)
      ]);

      if (!customer || !['Customer', 'Both'].includes(customer.type)) {
        const error = new Error('Selected customer was not found or is not a customer');
        error.statusCode = 400;
        throw error;
      }
      if (!dispatch) {
        const error = new Error('Delivery challan does not belong to the selected customer');
        error.statusCode = 400;
        throw error;
      }
      if (existingInvoice) {
        const error = new Error('This delivery challan has already been invoiced');
        error.statusCode = 409;
        throw error;
      }

      const dispatchedByBox = new Map();
      for (const line of dispatch.boxes) {
        const key = String(line.boxId);
        dispatchedByBox.set(key, (dispatchedByBox.get(key) || 0) + Number(line.dispatchQuantity));
      }

      const invoicedByBox = new Map();
      for (const item of cleanItems) {
        const key = String(item.boxId);
        invoicedByBox.set(key, (invoicedByBox.get(key) || 0) + item.quantity);
      }
      for (const [boxId, quantity] of invoicedByBox) {
        if (!dispatchedByBox.has(boxId) || quantity > dispatchedByBox.get(boxId)) {
          const error = new Error('Invoice quantities must not exceed the selected challan quantities');
          error.statusCode = 400;
          throw error;
        }
      }

      const finishedBoxes = await FinishedBox.find({ _id: { $in: [...invoicedByBox.keys()] } }).session(session);
      const finishedBoxById = new Map(finishedBoxes.map((box) => [String(box._id), box]));
      const invoiceItems = cleanItems.map((item) => {
        const box = finishedBoxById.get(String(item.boxId));
        const hasCost = box?.costingStatus === 'available' && Number.isFinite(Number(box.costPerBox));
        const taxableAmount = Number((item.quantity * item.rate).toFixed(2));
        const costPerBox = hasCost ? Number(box.costPerBox) : null;
        const costOfGoods = hasCost ? Number((item.quantity * costPerBox).toFixed(2)) : null;
        return {
          boxId: item.boxId,
          quantity: item.quantity,
          rate: item.rate,
          taxableAmount,
          costPerBox,
          costOfGoods,
          grossProfit: hasCost ? Number((taxableAmount - costOfGoods).toFixed(2)) : null,
          costingStatus: hasCost ? 'available' : 'unavailable'
        };
      });
      const costingAvailable = invoiceItems.every((item) => item.costingStatus === 'available');
      const totalCostOfGoods = costingAvailable
        ? Number(invoiceItems.reduce((sum, item) => sum + item.costOfGoods, 0).toFixed(2))
        : null;
      const grossProfit = costingAvailable
        ? Number((invoiceItems.reduce((sum, item) => sum + item.taxableAmount, 0) - totalCostOfGoods).toFixed(2))
        : null;
      const subTotal = Number(invoiceItems.reduce((sum, item) => sum + item.taxableAmount, 0).toFixed(2));
      const cgstAmount = Number((subTotal * gst / 200).toFixed(2));
      const sgstAmount = Number((subTotal * gst / 200).toFixed(2));
      const grandTotal = Number((subTotal + cgstAmount + sgstAmount).toFixed(2));
      const dateKey = invoiceDate.slice(2).replace(/-/g, '');
      const invoiceNumber = `INV-${dateKey}-${Date.now()}-${crypto.randomInt(1000, 10000)}`;

      const [created] = await Invoice.create([{
        invoiceNumber,
        invoiceDate: date,
        customerId,
        dispatchId,
        items: invoiceItems,
        subTotal,
        gstPercent: gst,
        cgstAmount,
        sgstAmount,
        grandTotal,
        balanceDue: grandTotal,
        costOfGoods: totalCostOfGoods,
        grossProfit,
        costingStatus: costingAvailable ? 'available' : 'unavailable'
      }], { session });

      const newBalance = Number((Number(customer.balance || 0) + grandTotal).toFixed(2));
      customer.ledger.push({
        date,
        type: 'Tax Invoice',
        ref: invoiceNumber,
        debit: grandTotal,
        credit: 0,
        balance: newBalance
      });
      customer.balance = newBalance;
      await customer.save({ session });
      await writeAuditLog(req, { action: 'invoice.created', entityType: 'Invoice', entityId: created._id, entityLabel: invoiceNumber, summary: 'Sales invoice created: ' + invoiceNumber, metadata: { customerId: String(customerId), dispatchId: String(dispatchId), subTotal, gstPercent: gst, grandTotal, costOfGoods: totalCostOfGoods, grossProfit, costingStatus: costingAvailable ? 'available' : 'unavailable' } }, session);
      createdInvoice = created;
    });

    return res.status(201).json(createdInvoice);
  } catch (error) {
    console.error('[INVOICE] Creation failed:', error.message);
    if (!res.headersSent) {
      res.status(error.statusCode || (error.name === 'ValidationError' ? 400 : 500))
        .json({ message: error.message || 'Unable to create invoice' });
    }
  } finally {
    await session.endSession();
  }
};
