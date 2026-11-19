const mongoose = require('mongoose');
const InvoiceSequence = require('../models/InvoiceSequence.model');
const CompanyProfile = require('../models/CompanyProfile.model');
const Invoice = require('../models/Invoice.model');
const Dispatch = require('../models/Dispatch.model');
const Party = require('../models/Party.model');
const FinishedBox = require('../models/FinishedBox.model');
const writeAuditLog = require('../utils/writeAuditLog');
const { buildDateRangeFilter, isValidDateOnly } = require('../utils/dateFilters');
const { matchesDispatchQuantities } = require('../utils/dispatchInvoiceValidation');
const { recalculatePartyLedger } = require('../utils/partyLedger');
const { normalizeStateCode, getCompanyStateCode, calculateGstBreakdown } = require('../utils/gst');

const VALID_COMPANIES = ['sk-packaging', 'nsb-industrial-solutions'];
function currentCompanyKey(req) { return VALID_COMPANIES.includes(req.companyKey) ? req.companyKey : 'sk-packaging'; }
function invoiceCompanyFilter(req) {
  const companyKey = currentCompanyKey(req);
  return companyKey === 'sk-packaging'
    ? { $or: [{ companyKey: 'sk-packaging' }, { companyKey: { $exists: false } }] }
    : { companyKey };
}
async function buildSellerSnapshot(companyKey, session) {
  const profile = await CompanyProfile.findOne({ companyKey }).session(session || null).lean();
  if (!profile) return null;
  return {
    legalName: profile.legalName || profile.tradeName || '',
    tradeName: profile.tradeName || '',
    address: [profile.registeredAddress, profile.city, profile.stateName, profile.pincode].filter(Boolean).join(', '),
    gstin: profile.gstin || '',
    phone: profile.phone || '',
    email: profile.email || '',
    logoUrl: profile.logoUrl || '',
    signatoryName: profile.signatoryName || '',
    invoiceTerms: profile.invoiceTerms || ''
  };
}
async function companyStateCode(req) {
  const key = currentCompanyKey(req);
  const profile = await CompanyProfile.findOne({ companyKey: key }).select('gstin stateCode').lean();
  if (profile?.stateCode || profile?.gstin) return getCompanyStateCode({ GSTIN: profile.gstin, GST_STATE_CODE: profile.stateCode });
  const env = key === 'nsb-industrial-solutions'
    ? { GSTIN: process.env.NSB_GSTIN, GST_STATE_CODE: process.env.NSB_GST_STATE_CODE }
    : { GSTIN: process.env.SK_GSTIN || process.env.GSTIN, GST_STATE_CODE: process.env.SK_GST_STATE_CODE || process.env.GST_STATE_CODE };
  return getCompanyStateCode(env);
}
function getFinancialYear(dateOnly) {
  const year = Number(String(dateOnly).slice(0, 4));
  const month = Number(String(dateOnly).slice(5, 7));
  const startYear = month >= 4 ? year : year - 1;
  return String(startYear).slice(-2) + '-' + String(startYear + 1).slice(-2);
}
async function nextInvoiceNumber(companyKey, invoiceDate, session) {
  const financialYear = getFinancialYear(invoiceDate);
  const sequence = await InvoiceSequence.findOneAndUpdate(
    { companyKey, financialYear },
    { $inc: { nextNumber: 1 }, $setOnInsert: { companyKey, financialYear } },
    { new: true, upsert: true, setDefaultsOnInsert: true, session }
  );
  const profile = await CompanyProfile.findOne({ companyKey }).select('invoicePrefix').lean();
  const prefix = profile?.invoicePrefix || (companyKey === 'nsb-industrial-solutions'
    ? (process.env.NSB_INVOICE_PREFIX || 'NSB')
    : (process.env.SK_INVOICE_PREFIX || 'SK'));
  return prefix + '/' + financialYear + '/' + String(sequence.nextNumber).padStart(4, '0');
}




exports.getInvoiceById = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid invoice ID.' });
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, ...invoiceCompanyFilter(req) })
      .populate('customerId')
      .populate('dispatchId')
      .populate('items.boxId')
      .lean();
    if (!invoice) return res.status(404).json({ message: 'Invoice not found.' });
    if (!invoice.sellerSnapshot || !invoice.sellerSnapshot.legalName) {
      invoice.sellerSnapshot = await buildSellerSnapshot(currentCompanyKey(req));
    }
    return res.json({ invoice });
  } catch (error) {
    console.error('[INVOICE] Detail fetch failed:', error.message);
    return res.status(500).json({ message: 'Unable to fetch invoice details.' });
  }
};

exports.cancelInvoice = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid invoice ID.' });
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (reason.length < 10 || reason.length > 500) return res.status(400).json({ message: 'Enter a cancellation reason between 10 and 500 characters.' });
  const session = await mongoose.startSession();
  try {
    let cancelled;
    await session.withTransaction(async () => {
      const target = await Invoice.findOne({ _id: req.params.id, ...invoiceCompanyFilter(req) }).session(session);
      if (!target) throw Object.assign(new Error('Invoice not found.'), { statusCode: 404 });
      if (target.status === 'Cancelled') throw Object.assign(new Error('Invoice is already cancelled.'), { statusCode: 409 });
      if ((target.payments || []).length || Math.abs(Number(target.balanceDue || 0) - Number(target.grandTotal || 0)) > 0.005) {
        throw Object.assign(new Error('This invoice has payment allocations. A credit-note/refund workflow is required; it cannot be cancelled directly.'), { statusCode: 409 });
      }
      const dispatch = await Dispatch.findOne({ _id: target.dispatchId, companyKey: currentCompanyKey(req) }).session(session);
      if (dispatch?.status === 'delivered') throw Object.assign(new Error('A delivered dispatch cannot be cancelled through this workflow.'), { statusCode: 409 });
      const party = await Party.findOne({ _id: target.customerId, companyKey: currentCompanyKey(req) }).session(session);
      if (!party) throw Object.assign(new Error('Linked customer ledger was not found. No changes were made.'), { statusCode: 409 });
      const ledgerEntry = party.ledger.find(entry => entry.type === 'Tax Invoice' && entry.ref === target.invoiceNumber);
      if (!ledgerEntry) throw Object.assign(new Error('Matching invoice entry was not found in the customer ledger. Reconcile the ledger before cancelling.'), { statusCode: 409 });
      party.ledger.pull({ _id: ledgerEntry._id });
      party.balance = recalculatePartyLedger(party.ledger);
      await party.save({ session });
      target.status = 'Cancelled';
      target.balanceDue = 0;
      await target.save({ session });
      await writeAuditLog(req, { action: 'invoice.cancelled', entityType: 'Invoice', entityId: target._id, entityLabel: target.invoiceNumber, summary: 'Invoice cancelled: ' + target.invoiceNumber, metadata: { reason, customerId: String(target.customerId), dispatchId: String(target.dispatchId), grandTotal: target.grandTotal } }, session);
      cancelled = target;
    });
    return res.json({ message: 'Invoice cancelled and customer ledger debit reversed.', invoice: cancelled });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Unable to cancel invoice.' });
  } finally { await session.endSession(); }
};

exports.getInvoices = async (req, res) => {
  try {
    const filter = { ...buildDateRangeFilter(req.query.from, req.query.to, 'invoiceDate'), ...invoiceCompanyFilter(req) };
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
      Dispatch.find({ customerId, companyKey: currentCompanyKey(req), status: { $ne: 'cancelled' } }).populate('boxes.boxId').sort({ createdAt: -1 }).lean(),
      Invoice.find({ customerId, ...invoiceCompanyFilter(req) }).select('dispatchId').lean()
    ]);
    const billedIds = new Set(billed.map((invoice) => String(invoice.dispatchId)));
    return res.json(dispatches.filter((dispatch) => !billedIds.has(String(dispatch._id))));
  } catch (error) {
    console.error('[INVOICE] Unable to list unbilled challans:', error.message);
    return res.status(500).json({ message: 'Unable to fetch unbilled delivery challans' });
  }
};

exports.getTaxContext = async (req, res) => {
  const stateCode = await companyStateCode(req);
  return res.json({
    companyStateCode: stateCode || null,
    configured: Boolean(stateCode),
    companyKey: currentCompanyKey(req)
  });
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
    const supplierStateCode = await companyStateCode(req);
    if (!supplierStateCode) return res.status(503).json({ message: 'Company GST state is not configured. Set GST_STATE_CODE (or GSTIN) before creating invoices.' });
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
      // Keep all operations on the transaction session sequential.
      const companyKey = currentCompanyKey(req);
      const customer = await Party.findOne({ _id: customerId, companyKey }).session(session);
      const dispatch = await Dispatch.findOne({ _id: dispatchId, customerId, companyKey }).session(session);
      const existingInvoice = await Invoice.findOne({ dispatchId, ...invoiceCompanyFilter(req) }).session(session);

      if (!customer || customer.isActive === false || !['Customer', 'Both'].includes(customer.type)) {
        const error = new Error('Selected customer was not found or is not a customer');
        error.statusCode = 400;
        throw error;
      }
      const placeOfSupplyStateCode = normalizeStateCode(req.body?.placeOfSupplyStateCode || customer?.stateCode);
      if (!placeOfSupplyStateCode) {
        const error = new Error('Customer state code is missing or invalid. Edit the customer in Party Master and enter its two-digit GST state code before invoicing.');
        error.statusCode = 422;
        throw error;
      }
      if (!dispatch) {
        const error = new Error('Delivery challan does not belong to the selected customer');
        error.statusCode = 400;
        throw error;
      }
      if (dispatch.status === 'cancelled') {
        const error = new Error('A cancelled delivery challan cannot be invoiced.');
        error.statusCode = 409;
        throw error;
      }
      if (existingInvoice) {
        const error = new Error('This delivery challan has already been invoiced');
        error.statusCode = 409;
        throw error;
      }

      if (!matchesDispatchQuantities(dispatch.boxes, cleanItems)) {
        const error = new Error('Invoice quantities must exactly match every box quantity on the selected delivery challan. Partial or omitted challan lines cannot be invoiced.');
        error.statusCode = 400;
        throw error;
      }

      const invoicedByBox = new Map();
      for (const item of cleanItems) {
        const key = String(item.boxId);
        invoicedByBox.set(key, (invoicedByBox.get(key) || 0) + item.quantity);
      }

      const finishedBoxes = await FinishedBox.find({ _id: { $in: [...invoicedByBox.keys()] }, companyKey }).session(session);
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
      const tax = calculateGstBreakdown({ taxableAmount: subTotal, gstPercent: gst, supplierStateCode, placeOfSupplyStateCode });
      const { cgstAmount, sgstAmount, igstAmount, taxType } = tax;
      const grandTotal = Number((subTotal + cgstAmount + sgstAmount + igstAmount).toFixed(2));
      const invoiceNumber = await nextInvoiceNumber(companyKey, invoiceDate, session);

      const [created] = await Invoice.create([{
        companyKey,
        invoiceNumber,
        sellerSnapshot: await buildSellerSnapshot(companyKey, session),
        invoiceDate: date,
        customerId,
        dispatchId,
        items: invoiceItems,
        subTotal,
        gstPercent: gst,
        cgstAmount,
        sgstAmount,
        igstAmount,
        taxType,
        placeOfSupplyStateCode,
        grandTotal,
        balanceDue: grandTotal,
        costOfGoods: totalCostOfGoods,
        grossProfit,
        costingStatus: costingAvailable ? 'available' : 'unavailable'
      }], { session });

      customer.ledger.push({
        date,
        type: 'Tax Invoice',
        ref: invoiceNumber,
        debit: grandTotal,
        credit: 0,
        balance: 0
      });
      customer.balance = recalculatePartyLedger(customer.ledger);
      await customer.save({ session });
      await writeAuditLog(req, { action: 'invoice.created', entityType: 'Invoice', entityId: created._id, entityLabel: invoiceNumber, summary: 'Sales invoice created: ' + invoiceNumber, metadata: { customerId: String(customerId), dispatchId: String(dispatchId), subTotal, gstPercent: gst, taxType, placeOfSupplyStateCode, grandTotal, costOfGoods: totalCostOfGoods, grossProfit, costingStatus: costingAvailable ? 'available' : 'unavailable' } }, session);
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
