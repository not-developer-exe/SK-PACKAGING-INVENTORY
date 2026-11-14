const mongoose = require('mongoose');
const crypto = require('crypto');
const Invoice = require('../models/Invoice.model');
const Dispatch = require('../models/Dispatch.model');
const Party = require('../models/Party.model');
const writeAuditLog = require('../utils/writeAuditLog');

exports.getInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find()
      .populate('customerId', 'name')
      .populate('dispatchId', 'challanNumber dispatchDate')
      .sort({ invoiceDate: -1, createdAt: -1 })
      .lean();
    return res.json({ invoices });
  } catch (error) {
    console.error('[INVOICE] List failed:', error.message);
    return res.status(500).json({ message: 'Unable to fetch invoices.' });
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

    const date = new Date(invoiceDate);
    const gst = Number(gstPercent);
    if (Number.isNaN(date.getTime()) || !Number.isFinite(gst) || gst < 0 || gst > 40) {
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

      const invoiceItems = cleanItems.map((item) => ({
        boxId: item.boxId,
        quantity: item.quantity,
        rate: item.rate,
        taxableAmount: Number((item.quantity * item.rate).toFixed(2))
      }));
      const subTotal = Number(invoiceItems.reduce((sum, item) => sum + item.taxableAmount, 0).toFixed(2));
      const cgstAmount = Number((subTotal * gst / 200).toFixed(2));
      const sgstAmount = Number((subTotal * gst / 200).toFixed(2));
      const grandTotal = Number((subTotal + cgstAmount + sgstAmount).toFixed(2));
      const dateKey = date.toISOString().slice(2, 10).replace(/-/g, '');
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
        balanceDue: grandTotal
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
      await writeAuditLog(req, { action: 'invoice.created', entityType: 'Invoice', entityId: created._id, entityLabel: invoiceNumber, summary: 'Sales invoice created: ' + invoiceNumber, metadata: { customerId: String(customerId), dispatchId: String(dispatchId), subTotal, gstPercent: gst, grandTotal } }, session);
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
