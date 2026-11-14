const test = require('node:test');
const assert = require('node:assert/strict');
const { recalculatePartyLedger } = require('../src/utils/partyLedger');

test('recalculates running balances in transaction-date order with opening balance first', () => {
  const ledger = [
    { _id: 'c', type: 'Payment Received', date: '2026-01-03', debit: 0, credit: 200, balance: 0 },
    { _id: 'a', type: 'Opening Balance', date: '2026-01-02', debit: 0, credit: 1000, balance: 1000 },
    { _id: 'b', type: 'Tax Invoice', date: '2026-01-02', debit: 500, credit: 0, balance: 0 },
    { _id: 'd', type: 'Payment Received', date: '2026-01-01', debit: 0, credit: 100, balance: 0 }
  ];
  const balance = recalculatePartyLedger(ledger);
  assert.equal(balance, 200);
  assert.equal(ledger.find(item => item._id === 'd').balance, 900);
  assert.equal(ledger.find(item => item._id === 'b').balance, 1400);
  assert.equal(ledger.find(item => item._id === 'c').balance, 1200);
});

test('preserves legacy opening balance snapshots while recalculating later entries', () => {
  const ledger = [
    { type: 'Opening Balance', debit: 1000, credit: 0, balance: -1000 },
    { type: 'Tax Invoice', debit: 500, credit: 0, balance: 0 }
  ];
  assert.equal(recalculatePartyLedger(ledger), -500);
  assert.equal(ledger[1].balance, -500);
});

test('rejects invalid ledger data', () => {
  assert.throws(() => recalculatePartyLedger(null), /must be an array/i);
  assert.throws(() => recalculatePartyLedger([{ type: 'Opening Balance', balance: 'bad' }]), /opening balance must be finite/i);
});
