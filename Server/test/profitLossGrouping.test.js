const test = require('node:test');
const assert = require('node:assert/strict');
const { buildProfitLossGroups, isValidDateOnly } = require('../src/utils/profitLossAggregation');

test('builds daily, monthly and party-wise invoice groupings', () => {
  const groups = buildProfitLossGroups([
    {
      invoiceDate: '2026-11-14T10:00:00.000Z',
      customerId: { _id: 'party-a', name: 'Customer A' },
      subTotal: 1000, costOfGoods: 600, grossProfit: 400,
      costingStatus: 'available', balanceDue: 500
    },
    {
      invoiceDate: '2026-11-14T11:00:00.000Z',
      customerId: { _id: 'party-a', name: 'Customer A' },
      subTotal: 500, costOfGoods: null, grossProfit: null,
      costingStatus: 'unavailable', balanceDue: 500
    },
    {
      invoiceDate: '2026-11-15T10:00:00.000Z',
      customerId: { _id: 'party-b', name: 'Customer B' },
      subTotal: 750, costOfGoods: 450, grossProfit: 300,
      costingStatus: 'available', balanceDue: 0
    }
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

test('validates real calendar dates instead of accepting rolled dates', () => {
  assert.equal(isValidDateOnly('2026-11-14'), true);
  assert.equal(isValidDateOnly('2026-02-30'), false);
  assert.equal(isValidDateOnly('not-a-date'), false);
});
