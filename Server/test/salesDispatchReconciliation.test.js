const test = require('node:test');
const assert = require('node:assert/strict');
const { reconcileSalesDispatch } = require('../src/utils/salesDispatchReconciliation');

const dispatch = {
  _id: 'dispatch-1', challanNumber: 'DC-000001', dispatchDate: new Date('2026-11-01'),
  customerId: { _id: 'customer-1', name: 'Acme' }, status: 'delivered',
  boxes: [{ boxId: 'box-1', dispatchQuantity: 10 }]
};
const invoice = {
  _id: 'invoice-1', dispatchId: 'dispatch-1', invoiceNumber: 'INV-1',
  invoiceDate: new Date('2026-11-02'), customerId: { _id: 'customer-1', name: 'Acme' },
  status: 'Pending', items: [{ boxId: 'box-1', quantity: 10, rate: 100, taxableAmount: 1000 }],
  subTotal: 1000, cgstAmount: 90, sgstAmount: 90, igstAmount: 0, grandTotal: 1180,
  payments: [{ amount: 180 }], balanceDue: 1000, costingStatus: 'available',
  costOfGoods: 700, grossProfit: 300
};
const party = { _id: 'customer-1', ledger: [
  { _id: 'bill-entry-1', type: 'Tax Invoice', ref: 'INV-1', debit: 1180 },
  { type: 'Payment Received', credit: 180, allocations: [{ billEntryId: 'bill-entry-1', amount: 180 }] }
] };

test('reconciles a delivered dispatch, invoice totals, customer ledger and payment balance', () => {
  const result = reconcileSalesDispatch({ dispatches: [dispatch], invoices: [invoice], parties: [party] });
  assert.equal(result.exceptionCount, 0);
  assert.equal(result.totals.invoicedDispatches, 1);
  assert.equal(result.totals.dispatchedBoxes, 10);
  assert.equal(result.totals.taxableSales, 1000);
  assert.equal(result.totals.gst, 180);
  assert.equal(result.totals.invoiceTotal, 1180);
  assert.equal(result.totals.recordedPayments, 180);
  assert.equal(result.totals.outstanding, 1000);
  assert.equal(result.totals.grossProfit, 300);
});

test('flags missing invoice for an active dispatch', () => {
  const result = reconcileSalesDispatch({ dispatches: [dispatch] });
  assert.equal(result.totals.uninvoicedDispatches, 1);
  assert.match(result.rows[0].issues[0], /No invoice linked/);
});

test('flags quantity, payment and ledger mismatches', () => {
  const changed = { ...invoice, items: [{ boxId: 'box-1', quantity: 9, rate: 100, taxableAmount: 900 }], balanceDue: 999 };
  const result = reconcileSalesDispatch({ dispatches: [dispatch], invoices: [changed], parties: [] });
  assert.ok(result.rows[0].issues.some((issue) => issue.includes('quantities')));
  assert.ok(result.rows[0].issues.some((issue) => issue.includes('Payment total')));
  assert.ok(result.rows[0].issues.some((issue) => issue.includes('ledger')));
});

test('does not count a cancelled dispatch as an uninvoiced delivery', () => {
  const result = reconcileSalesDispatch({ dispatches: [{ ...dispatch, status: 'cancelled' }] });
  assert.equal(result.totals.cancelledDispatches, 1);
  assert.equal(result.totals.uninvoicedDispatches, 0);
  assert.equal(result.totals.dispatchedBoxes, 0);
});

test('flags an active invoice attached to a cancelled dispatch', () => {
  const result = reconcileSalesDispatch({ dispatches: [{ ...dispatch, status: 'cancelled' }], invoices: [invoice], parties: [party] });
  assert.ok(result.rows[0].issues.some((issue) => issue.includes('Cancelled dispatch')));
  assert.equal(result.totals.dispatchedBoxes, 0);
});
