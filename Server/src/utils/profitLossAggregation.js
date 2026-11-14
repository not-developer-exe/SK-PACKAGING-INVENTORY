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

const ensureGroup = (map, key) => {
  if (!map.has(key)) {
    map.set(key, {
      key, invoiceCount: 0, revenue: 0, costOfGoods: 0, grossProfit: 0,
      costedInvoiceCount: 0, uncostedInvoiceCount: 0, balanceDue: 0,
      productionRunCount: 0, processLossKg: 0, processLossCostEstimate: 0,
      recoverableScrapGeneratedKg: 0, scrapRevenue: 0, scrapSoldKg: 0
    });
  }
  return map.get(key);
};

const addToGroup = (map, key, invoice) => {
  const group = ensureGroup(map, key);
  group.invoiceCount += 1;
  group.revenue += Number(invoice.subTotal || 0);
  group.balanceDue += Number(invoice.balanceDue || 0);
  if (invoice.costingStatus === 'available' &&
      invoice.costOfGoods !== null && invoice.costOfGoods !== undefined &&
      Number.isFinite(Number(invoice.costOfGoods))) {
    group.costOfGoods += Number(invoice.costOfGoods);
    group.grossProfit += Number(invoice.grossProfit || 0);
    group.costedInvoiceCount += 1;
  } else {
    group.uncostedInvoiceCount += 1;
  }
};

const addRunToGroup = (map, key, run) => {
  const group = ensureGroup(map, key);
  const inputWeight = Number(run.totalInputWeightKg || 0);
  const materialCost = Number(run.totalMaterialCost || 0);
  const processLossKg = Number(run.processLossKg || 0);
  group.productionRunCount += 1;
  group.processLossKg += processLossKg;
  group.recoverableScrapGeneratedKg += Number(run.recoverableWasteKg || 0);
  if (inputWeight > 0 && materialCost >= 0) {
    group.processLossCostEstimate += processLossKg * materialCost / inputWeight;
  }
};

const addScrapSaleToGroup = (map, key, sale) => {
  const group = ensureGroup(map, key);
  group.scrapRevenue += Number(sale.totalAmount || 0);
  group.scrapSoldKg += Number(sale.weightSoldKg || 0);
};

const normalize = (group) => ({
  ...group,
  revenue: Number(group.revenue.toFixed(2)),
  costOfGoods: Number(group.costOfGoods.toFixed(2)),
  grossProfit: Number(group.grossProfit.toFixed(2)),
  balanceDue: Number(group.balanceDue.toFixed(2)),
  processLossKg: Number(group.processLossKg.toFixed(3)),
  processLossCostEstimate: Number(group.processLossCostEstimate.toFixed(2)),
  recoverableScrapGeneratedKg: Number(group.recoverableScrapGeneratedKg.toFixed(3)),
  scrapRevenue: Number(group.scrapRevenue.toFixed(2)),
  scrapSoldKg: Number(group.scrapSoldKg.toFixed(3))
});

function buildProfitLossGroups(invoices, productionRuns = [], scrapSales = []) {
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
  for (const run of productionRuns) {
    addRunToGroup(dailyMap, dateKey(run.runDate, 'daily'), run);
    addRunToGroup(monthlyMap, dateKey(run.runDate, 'monthly'), run);
  }
  for (const sale of scrapSales) {
    addScrapSaleToGroup(dailyMap, dateKey(sale.saleDate, 'daily'), sale);
    addScrapSaleToGroup(monthlyMap, dateKey(sale.saleDate, 'monthly'), sale);
  }
  return {
    daily: [...dailyMap.values()].sort((a, b) => a.key.localeCompare(b.key)).map(normalize),
    monthly: [...monthlyMap.values()].sort((a, b) => a.key.localeCompare(b.key)).map(normalize),
    partyWise: [...partyMap.values()].sort((a, b) => b.revenue - a.revenue).map(normalize)
  };
}

function isValidDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

module.exports = { buildProfitLossGroups, isValidDateOnly };
