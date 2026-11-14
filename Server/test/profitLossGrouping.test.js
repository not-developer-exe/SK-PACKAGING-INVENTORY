const test = require('node:test');
const assert = require('node:assert/strict');
const { buildProfitLossGroups, isValidDateOnly } = require('../src/utils/profitLossAggregation');

test('builds daily monthly and party-wise invoice groups with costing coverage', () => {
  const groups = buildProfitLossGroups([
    { invoiceDate: '2026-11-14T10:00:00.000Z', customerId: { _id: 'a', name: 'Customer A' }, subTotal: 1000, costOfGoods: 600, grossProfit: 400, costingStatus: 'available', balanceDue: 500 },
    { invoiceDate: '2026-11-14T11:00:00.000Z', customerId: { _id: 'a', name: 'Customer A' }, subTotal: 500, costOfGoods: null, grossProfit: null, costingStatus: 'unavailable', balanceDue: 500 },
    { invoiceDate: '2026-11-15T10:00:00.000Z', customerId: { _id: 'b', name: 'Customer B' }, subTotal: 750, costOfGoods: 450, grossProfit: 300, costingStatus: 'available', balanceDue: 0 }
  ]);
  assert.equal(groups.daily.length, 2);
  assert.equal(groups.monthly.length, 1);
  assert.equal(groups.monthly[0].revenue, 2250);
  assert.equal(groups.monthly[0].costOfGoods, 1050);
  assert.equal(groups.monthly[0].grossProfit, 700);
  assert.equal(groups.monthly[0].uncostedInvoiceCount, 1);
  assert.equal(groups.partyWise[0].partyName, 'Customer A');
  assert.equal(groups.partyWise[0].balanceDue, 1000);
});

test('includes production loss, scrap generation and scrap proceeds in period groups', () => {
  const groups = buildProfitLossGroups([], [
    { runDate: '2026-11-14T08:00:00.000Z', totalInputWeightKg: 100, totalMaterialCost: 3000, processLossKg: 3, recoverableWasteKg: 5 }
  ], [
    { saleDate: '2026-11-14T13:00:00.000Z', weightSoldKg: 2, totalAmount: 100 }
  ]);
  assert.equal(groups.daily[0].processLossKg, 3);
  assert.equal(groups.daily[0].processLossCostEstimate, 90);
  assert.equal(groups.daily[0].recoverableScrapGeneratedKg, 5);
  assert.equal(groups.daily[0].scrapSoldKg, 2);
  assert.equal(groups.daily[0].scrapRevenue, 100);
});

test('validates real calendar dates instead of accepting rolled dates', () => {
  assert.equal(isValidDateOnly('2026-11-14'), true);
  assert.equal(isValidDateOnly('2026-02-30'), false);
  assert.equal(isValidDateOnly('not-a-date'), false);
});


test('groups operating, finance and landed-stock expenses into daily and monthly profit', () => {
  const groups = buildProfitLossGroups([
    { invoiceDate: '2026-11-14T10:00:00.000Z', customerId: { _id: 'a', name: 'Customer A' }, subTotal: 1000, costOfGoods: 600, grossProfit: 400, costingStatus: 'available', balanceDue: 0 }
  ], [], [
    { saleDate: '2026-11-14T13:00:00.000Z', weightSoldKg: 1, totalAmount: 50 }
  ], [
    { expenseDate: '2026-11-14T06:00:00.000Z', amount: 100, costTreatment: 'operating_expense' },
    { expenseDate: '2026-11-14T06:00:00.000Z', amount: 20, costTreatment: 'finance_cost' },
    { expenseDate: '2026-11-14T06:00:00.000Z', amount: 30, costTreatment: 'stock_landed_cost' }
  ]);
  assert.equal(groups.daily[0].operatingExpenses, 100);
  assert.equal(groups.daily[0].financeCosts, 20);
  assert.equal(groups.daily[0].stockLandedCosts, 30);
  assert.equal(groups.daily[0].operatingProfit, 350);
  assert.equal(groups.daily[0].netProfitBeforeTax, 330);
  assert.equal(groups.monthly[0].expenseCount, 3);
  assert.equal(groups.partyWise[0].operatingProfit, null);
});
