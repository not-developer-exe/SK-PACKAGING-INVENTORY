const mongoose = require('mongoose');
const Invoice = require('../models/Invoice.model');
const ScrapSale = require('../models/ScrapSale.model');

const dateKey = (value, mode) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date(value));
  const year = parts.find((part) => part.type === 'year').value;
  const month = parts.find((part) => part.type === 'month').value;
  const day = parts.find((part) => part.type === 'day').value;
  return mode === 'monthly' ? year + '-' + month : year + '-' + month + '-' + day;
};

const addToGroup = (map, key, invoice) => {
  if (!map.has(key)) {
    map.set(key, {
      key,
      invoiceCount: 0,
      revenue: 0,
      costOfGoods: 0,
      grossProfit: 0,
      costedInvoiceCount: 0,
      uncostedInvoiceCount: 0,
      balanceDue: 0
    });
  }
  const group = map.get(key);
  group.invoiceCount += 1;
  group.revenue += Number(invoice.subTotal || 0);
  group.balanceDue += Number(invoice.balanceDue || 0);
  if (invoice.costingStatus === 'available' && Number.isFinite(Number(invoice.costOfGoods))) {
    group.costOfGoods += Number(invoice.costOfGoods);
    group.grossProfit += Number(invoice.grossProfit || 0);
    group.costedInvoiceCount += 1;
  } else {
    group.uncostedInvoiceCount += 1;
  }
};

exports.getProfitLoss = async (req, res) => {
  try {
    const today = new Date();
    const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const from = req.query.from || defaultFrom;
    const to = req.query.to || today.toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
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

    const [invoices, scrapSales] = await Promise.all([
      Invoice.find(invoiceFilter)
        .populate('customerId', 'name')
        .select('invoiceNumber invoiceDate customerId subTotal costOfGoods grossProfit costingStatus balanceDue status')
        .sort({ invoiceDate: 1 })
        .lean(),
      ScrapSale.find({ saleDate: { $gte: fromDate, $lt: toDate } }).sort({ saleDate: 1 }).lean()
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

    const dailyMap = new Map();
    const monthlyMap = new Map();
    const partyMap = new Map();
    for (const invoice of invoices) {
      addToGroup(dailyMap, dateKey(invoice.invoiceDate, 'daily'), invoice);
      addToGroup(monthlyMap, dateKey(invoice.invoiceDate, 'monthly'), invoice);
      const partyId = String(invoice.customerId?._id || invoice.customerId || 'unknown');
      const partyName = invoice.customerId?.name || 'Unknown party';
      addToGroup(partyMap, partyId, invoice);
      partyMap.get(partyId).partyName = partyName;
    }

    const daily = [...dailyMap.values()].sort((a, b) => a.key.localeCompare(b.key));
    const monthly = [...monthlyMap.values()].sort((a, b) => a.key.localeCompare(b.key));
    const partyWise = [...partyMap.values()].sort((a, b) => b.revenue - a.revenue);
    for (const group of [...daily, ...monthly, ...partyWise]) {
      group.revenue = Number(group.revenue.toFixed(2));
      group.costOfGoods = Number(group.costOfGoods.toFixed(2));
      group.grossProfit = Number(group.grossProfit.toFixed(2));
      group.balanceDue = Number(group.balanceDue.toFixed(2));
    }

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
        'Labour, electricity, rent, finance charges and other operating expenses are not yet included; this is not net profit.'
      ]
    });
  } catch (error) {
    console.error('[PROFIT LOSS] Report failed:', error.message);
    return res.status(500).json({ message: 'Unable to generate profit and loss report.' });
  }
};
