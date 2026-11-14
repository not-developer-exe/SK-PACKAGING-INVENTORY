const InwardReceipt = require('../models/InwardReceipt.model');
const ProductionRun = require('../models/ProductionRun.model');
const FinishedBox = require('../models/FinishedBox.model');
const Dispatch = require('../models/Dispatch.model');
const Invoice = require('../models/Invoice.model');
const Expense = require('../models/Expense.model');
const ScrapSale = require('../models/ScrapSale.model');
const StockMovement = require('../models/StockMovement.model');
const { buildDateRangeFilter } = require('../utils/dateFilters');

const numeric = (value) => Number(value === null || value === undefined ? 0 : value.toString());
const round = (value, places = 2) => Number(value.toFixed(places));

function periodKey(value, monthly = false) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date(value));
  const year = parts.find((part) => part.type === 'year').value;
  const month = parts.find((part) => part.type === 'month').value;
  const day = parts.find((part) => part.type === 'day').value;
  return monthly ? year + '-' + month : year + '-' + month + '-' + day;
}

function emptyPeriod(key) {
  return {
    key,
    inwardReceipts: 0, inwardReels: 0, inwardWeightKg: 0,
    productionRuns: 0, inputWeightKg: 0, sheetOutputWeightKg: 0,
    finishedBatches: 0, boxesProduced: 0,
    dispatches: 0, boxesDispatched: 0,
    invoices: 0, salesExGst: 0, receivables: 0,
    expenses: 0, expenseEntries: 0,
    scrapSales: 0, scrapWeightKg: 0, scrapRevenue: 0,
    stockMovements: 0,
    reelQtyChange: 0, reelWeightChangeKg: 0,
    sheetQtyChange: 0, sheetWeightChangeKg: 0,
    finishedGoodsQtyChange: 0
  };
}

function getPeriod(map, key) {
  if (!map.has(key)) map.set(key, emptyPeriod(key));
  return map.get(key);
}

function addParty(map, id, name, type) {
  const key = type + ':' + String(id || 'unknown');
  if (!map.has(key)) {
    map.set(key, {
      key, partyId: id ? String(id) : null, partyName: name || 'Unknown party', partyType: type,
      inwardReceipts: 0, inwardWeightKg: 0, finishedBatches: 0, boxesProduced: 0,
      dispatches: 0, boxesDispatched: 0, invoices: 0, salesExGst: 0, receivables: 0
    });
  }
  return map.get(key);
}

function summarize(rows) {
  const total = emptyPeriod('total');
  for (const row of rows) {
    for (const key of Object.keys(total)) {
      if (key !== 'key' && typeof total[key] === 'number') total[key] += Number(row[key] || 0);
    }
  }
  for (const key of Object.keys(total)) if (key !== 'key') total[key] = round(total[key], key.toLowerCase().includes('weight') ? 3 : 2);
  return total;
}

function normalizePeriod(row) {
  const result = { ...row };
  for (const key of Object.keys(result)) {
    if (key !== 'key' && typeof result[key] === 'number') {
      result[key] = round(result[key], key.toLowerCase().includes('weight') ? 3 : 2);
    }
  }
  return result;
}

exports.getActivityReport = async (req, res) => {
  try {
    const receiptFilter = buildDateRangeFilter(req.query.from, req.query.to, 'receiptDate');
    const productionFilter = buildDateRangeFilter(req.query.from, req.query.to, 'runDate');
    const finishedFilter = buildDateRangeFilter(req.query.from, req.query.to, 'manufacturedAt');
    const dispatchFilter = buildDateRangeFilter(req.query.from, req.query.to, 'dispatchDate');
    const invoiceFilter = buildDateRangeFilter(req.query.from, req.query.to, 'invoiceDate');
    const expenseFilter = buildDateRangeFilter(req.query.from, req.query.to, 'expenseDate');
    const scrapFilter = buildDateRangeFilter(req.query.from, req.query.to, 'saleDate');
    const movementFilter = buildDateRangeFilter(req.query.from, req.query.to, 'createdAt');
    receiptFilter.status = 'posted';
    productionFilter.status = 'completed';
    invoiceFilter.status = { $ne: 'Cancelled' };

    const [receipts, runs, finishedGoods, dispatches, invoices, expenses, scrapSales, movements] = await Promise.all([
      InwardReceipt.find(receiptFilter).populate('supplierId', 'name').lean(),
      ProductionRun.find(productionFilter).lean(),
      FinishedBox.find(finishedFilter).populate('customerId', 'name').lean(),
      Dispatch.find(dispatchFilter).populate('customerId', 'name').lean(),
      Invoice.find(invoiceFilter).populate('customerId', 'name').lean(),
      Expense.find(expenseFilter).lean(),
      ScrapSale.find(scrapFilter).lean(),
      StockMovement.find(movementFilter).lean()
    ]);

    const dailyMap = new Map();
    const monthlyMap = new Map();
    const partyMap = new Map();
    const vendorMap = new Map();
    const scrapBuyerMap = new Map();

    const add = (date, updater) => {
      updater(getPeriod(dailyMap, periodKey(date)));
      updater(getPeriod(monthlyMap, periodKey(date, true)));
    };

    for (const receipt of receipts) {
      const weight = (receipt.lines || []).reduce((sum, line) => sum + numeric(line.totalWeightKg), 0);
      const reels = (receipt.lines || []).reduce((sum, line) => sum + Number(line.reelCount || 0), 0);
      add(receipt.receiptDate, (row) => {
        row.inwardReceipts += 1;
        row.inwardReels += reels;
        row.inwardWeightKg += weight;
      });
      const party = addParty(partyMap, receipt.supplierId?._id, receipt.supplierId?.name, 'Supplier');
      party.inwardReceipts += 1;
      party.inwardWeightKg += weight;
    }

    for (const run of runs) {
      add(run.runDate, (row) => {
        row.productionRuns += 1;
        row.inputWeightKg += numeric(run.totalInputWeightKg);
        row.sheetOutputWeightKg += numeric(run.totalOutputWeightKg);
      });
    }

    for (const box of finishedGoods) {
      add(box.manufacturedAt, (row) => {
        row.finishedBatches += 1;
        row.boxesProduced += Number(box.quantityProduced || 0);
      });
      const party = addParty(partyMap, box.customerId?._id, box.customerId?.name, 'Customer');
      party.finishedBatches += 1;
      party.boxesProduced += Number(box.quantityProduced || 0);
    }

    for (const dispatch of dispatches) {
      const quantity = (dispatch.boxes || []).reduce((sum, line) => sum + Number(line.dispatchQuantity || 0), 0);
      add(dispatch.dispatchDate, (row) => {
        row.dispatches += 1;
        row.boxesDispatched += quantity;
      });
      const party = addParty(partyMap, dispatch.customerId?._id, dispatch.customerId?.name, 'Customer');
      party.dispatches += 1;
      party.boxesDispatched += quantity;
    }

    for (const invoice of invoices) {
      add(invoice.invoiceDate, (row) => {
        row.invoices += 1;
        row.salesExGst += Number(invoice.subTotal || 0);
        row.receivables += Number(invoice.balanceDue || 0);
      });
      const party = addParty(partyMap, invoice.customerId?._id, invoice.customerId?.name, 'Customer');
      party.invoices += 1;
      party.salesExGst += Number(invoice.subTotal || 0);
      party.receivables += Number(invoice.balanceDue || 0);
    }

    for (const expense of expenses) {
      add(expense.expenseDate, (row) => {
        row.expenses += Number(expense.amount || 0);
        row.expenseEntries += 1;
      });
      const vendor = String(expense.vendor || 'Unspecified vendor').trim() || 'Unspecified vendor';
      if (!vendorMap.has(vendor)) vendorMap.set(vendor, { vendor, entries: 0, amount: 0 });
      vendorMap.get(vendor).entries += 1;
      vendorMap.get(vendor).amount += Number(expense.amount || 0);
    }

    for (const sale of scrapSales) {
      add(sale.saleDate, (row) => {
        row.scrapSales += 1;
        row.scrapWeightKg += Number(sale.weightSoldKg || 0);
        row.scrapRevenue += Number(sale.totalAmount || 0);
      });
      const buyer = String(sale.buyerName || 'Unknown buyer');
      if (!scrapBuyerMap.has(buyer)) scrapBuyerMap.set(buyer, { buyer, sales: 0, weightKg: 0, revenue: 0 });
      scrapBuyerMap.get(buyer).sales += 1;
      scrapBuyerMap.get(buyer).weightKg += Number(sale.weightSoldKg || 0);
      scrapBuyerMap.get(buyer).revenue += Number(sale.totalAmount || 0);
    }

    for (const movement of movements) {
      add(movement.createdAt, (row) => {
        row.stockMovements += 1;
        const quantityChange = Number(movement.quantityChange || 0);
        const weightChangeKg = numeric(movement.weightChangeKg);
        if (movement.itemType === 'reel') {
          row.reelQtyChange += quantityChange;
          row.reelWeightChangeKg += weightChangeKg;
        } else if (movement.itemType === 'sheet') {
          row.sheetQtyChange += quantityChange;
          row.sheetWeightChangeKg += weightChangeKg;
        } else if (movement.itemType === 'finished_good') {
          row.finishedGoodsQtyChange += quantityChange;
        }
      });
    }

    const daily = [...dailyMap.values()].sort((a, b) => a.key.localeCompare(b.key)).map(normalizePeriod);
    const monthly = [...monthlyMap.values()].sort((a, b) => a.key.localeCompare(b.key)).map(normalizePeriod);
    const partyWise = [...partyMap.values()].map((party) => {
      for (const key of Object.keys(party)) if (typeof party[key] === 'number') party[key] = round(party[key], key.toLowerCase().includes('weight') ? 3 : 2);
      return party;
    }).sort((a, b) => b.salesExGst - a.salesExGst || b.inwardWeightKg - a.inwardWeightKg);
    const vendors = [...vendorMap.values()].map((item) => ({ ...item, amount: round(item.amount) })).sort((a, b) => b.amount - a.amount);
    const scrapBuyers = [...scrapBuyerMap.values()].map((item) => ({ ...item, weightKg: round(item.weightKg, 3), revenue: round(item.revenue) })).sort((a, b) => b.revenue - a.revenue);

    return res.json({
      period: { from: req.query.from || null, to: req.query.to || null },
      summary: summarize(daily),
      daily,
      monthly,
      partyWise,
      vendors,
      scrapBuyers
    });
  } catch (error) {
    console.error('[ACTIVITY REPORT] Query failed:', error.message);
    return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Unable to generate activity report.' });
  }
};
