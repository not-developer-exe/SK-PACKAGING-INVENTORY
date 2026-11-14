const mongoose = require('mongoose');
const Invoice = require('../models/Invoice.model');
const ScrapSale = require('../models/ScrapSale.model');
const ProductionRun = require('../models/ProductionRun.model');

const { buildProfitLossGroups, isValidDateOnly } = require('../utils/profitLossAggregation');

const numeric = (value) => Number(value === null || value === undefined ? 0 : value.toString());

exports.getProfitLoss = async (req, res) => {
  try {
    const today = new Date();
    const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const from = req.query.from || defaultFrom;
    const to = req.query.to || today.toISOString().slice(0, 10);
    if (!isValidDateOnly(from) || !isValidDateOnly(to)) {
      return res.status(400).json({ message: 'Use YYYY-MM-DD for report dates.' });
    }
    if (req.query.partyId && !mongoose.isValidObjectId(req.query.partyId)) {
      return res.status(400).json({ message: 'Invalid party ID.' });
    }
    const fromDate = new Date(from + 'T00:00:00+05:30');
    const toDate = new Date(to + 'T00:00:00+05:30');
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || fromDate > toDate) {
      return res.status(400).json({ message: 'Report start date must be on or before end date.' });
    }
    toDate.setDate(toDate.getDate() + 1);

    const invoiceFilter = {
      invoiceDate: { $gte: fromDate, $lt: toDate },
      status: { $ne: 'Cancelled' }
    };
    if (req.query.partyId) invoiceFilter.customerId = req.query.partyId;

    const [invoices, scrapSales, productionRuns, allTimeWasteTotals] = await Promise.all([
      Invoice.find(invoiceFilter)
        .populate('customerId', 'name')
        .select('invoiceNumber invoiceDate customerId subTotal costOfGoods grossProfit costingStatus balanceDue status')
        .sort({ invoiceDate: 1 })
        .lean(),
      ScrapSale.find({ saleDate: { $gte: fromDate, $lt: toDate } }).sort({ saleDate: 1 }).lean(),
      ProductionRun.find({ runDate: { $gte: fromDate, $lt: toDate } })
        .select('runDate totalInputWeightKg totalMaterialCost processLossKg recoverableWasteKg')
        .lean(),
      Promise.all([
        ProductionRun.aggregate([{ $group: { _id: null, generated: { $sum: { $ifNull: ['$recoverableWasteKg', 0] } } } }]),
        ScrapSale.aggregate([{ $group: { _id: null, sold: { $sum: '$weightSoldKg' } } }])
      ])
    ]);

    const costedInvoices = invoices.filter((invoice) =>
      invoice.costingStatus === 'available' && Number.isFinite(Number(invoice.costOfGoods))
    );
    const uncostedInvoices = invoices.length - costedInvoices.length;
    const revenue = Number(invoices.reduce((sum, invoice) => sum + Number(invoice.subTotal || 0), 0).toFixed(2));
    const costOfGoods = Number(costedInvoices.reduce((sum, invoice) => sum + Number(invoice.costOfGoods || 0), 0).toFixed(2));
    const grossProfit = Number(costedInvoices.reduce((sum, invoice) => sum + Number(invoice.grossProfit || 0), 0).toFixed(2));
    const balanceDue = Number(invoices.reduce((sum, invoice) => sum + Number(invoice.balanceDue || 0), 0).toFixed(2));
    const scrapRevenue = Number(scrapSales.reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0).toFixed(2));
    const scrapWeightKg = Number(scrapSales.reduce((sum, sale) => sum + Number(sale.weightSoldKg || 0), 0).toFixed(3));
    const processLossKg = Number(productionRuns.reduce((sum, run) => sum + numeric(run.processLossKg), 0).toFixed(3));
    const processLossCostEstimate = Number(productionRuns.reduce((sum, run) => {
      const inputWeight = numeric(run.totalInputWeightKg);
      return sum + (inputWeight > 0 ? Number(run.processLossKg || 0) * numeric(run.totalMaterialCost) / inputWeight : 0);
    }, 0).toFixed(2));
    const recoverableScrapGeneratedKg = Number(productionRuns.reduce((sum, run) => sum + numeric(run.recoverableWasteKg), 0).toFixed(3));
    const allTimeGenerated = Number(allTimeWasteTotals[0][0]?.generated || 0);
    const allTimeSold = Number(allTimeWasteTotals[1][0]?.sold || 0);
    const currentVerifiedScrapInventoryKg = Number((allTimeGenerated - allTimeSold).toFixed(3));

    const { daily, monthly, partyWise } = buildProfitLossGroups(invoices, productionRuns, scrapSales);

    return res.json({
      period: { from, to },
      summary: {
        invoiceCount: invoices.length,
        revenue,
        costOfGoods,
        grossProfit,
        balanceDue,
        scrapRevenue,
        scrapWeightKg,
        processLossKg,
        processLossCostEstimate,
        recoverableScrapGeneratedKg,
        currentVerifiedScrapInventoryKg,
        costedInvoiceCount: costedInvoices.length,
        uncostedInvoiceCount: uncostedInvoices,
        grossProfitCoveragePercent: invoices.length ? Number((costedInvoices.length / invoices.length * 100).toFixed(1)) : 100
      },
      daily,
      monthly,
      partyWise,
      notes: [
        'Sales revenue is shown excluding GST.',
        'Cost of goods sold uses reel landed cost allocated to produced sheets by output weight, then to finished boxes by consumed sheet weight.',
        'Invoices without a recorded manufacturing cost are excluded from gross-profit totals and counted as uncosted.',
        'Scrap sale proceeds are shown separately and are not included in gross profit.',
        'Process-loss cost is an estimate using average raw material cost per input kilogram; it is not a separately posted accounting expense.',
        'Labour, electricity, rent, finance charges and other operating expenses are not yet included; this is not net profit.'
      ]
    });
  } catch (error) {
    console.error('[PROFIT LOSS] Report failed:', error.message);
    return res.status(500).json({ message: 'Unable to generate profit and loss report.' });
  }
};
