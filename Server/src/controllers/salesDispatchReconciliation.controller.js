const mongoose = require('mongoose');
const Dispatch = require('../models/Dispatch.model');
const Invoice = require('../models/Invoice.model');
const Party = require('../models/Party.model');
const { buildDateRangeFilter } = require('../utils/dateFilters');
const { reconcileSalesDispatch } = require('../utils/salesDispatchReconciliation');

exports.getSalesDispatchReconciliation = async (req, res) => {
  try {
    const dateFilter = buildDateRangeFilter(req.query.from, req.query.to, 'dispatchDate');
    const dispatchFilter = {
      ...dateFilter,
      $or: [{ companyKey: 'sk-packaging' }, { companyKey: { $exists: false } }]
    };
    if (req.query.customerId) {
      if (!mongoose.isValidObjectId(req.query.customerId)) {
        return res.status(400).json({ message: 'Invalid customer ID.' });
      }
      dispatchFilter.customerId = req.query.customerId;
    }
    const dispatches = await Dispatch.find(dispatchFilter)
      .populate('customerId', 'name')
      .sort({ dispatchDate: 1, createdAt: 1 })
      .limit(5000)
      .lean();
    const dispatchIds = dispatches.map((dispatch) => dispatch._id);
    const invoices = dispatchIds.length
      ? await Invoice.find({ dispatchId: { $in: dispatchIds } }).populate('customerId', 'name').lean()
      : [];
    const customerIds = [...new Set(invoices.map((invoice) => String(invoice.customerId?._id || invoice.customerId)).filter(Boolean))];
    const parties = customerIds.length
      ? await Party.find({ _id: { $in: customerIds } }).select('name ledger').lean()
      : [];
    const result = reconcileSalesDispatch({ dispatches, invoices, parties });
    return res.json({
      period: { from: req.query.from || null, to: req.query.to || null, basis: 'dispatchDate' },
      generatedAt: new Date().toISOString(),
      ...result,
      notes: [
        'The report is grouped by dispatch date; linked invoice dates may fall outside the selected dispatch period.',
        'Cancelled dispatches are shown for audit and are not counted as uninvoiced active deliveries.',
        'Profit figures use invoice cost snapshots. Pending-cost invoices are excluded from gross-profit coverage.',
        'This is an operational reconciliation report, not a statutory accounting statement.'
      ]
    });
  } catch (error) {
    console.error('[SALES DISPATCH RECONCILIATION]', error);
    return res.status(error.statusCode || 500).json({ message: 'Unable to generate sales and dispatch reconciliation.' });
  }
};
