const test = require('node:test');
const assert = require('node:assert/strict');
const { matchesDispatchQuantities } = require('../src/utils/dispatchInvoiceValidation');

test('accepts invoice lines that exactly cover all dispatched quantities', () => {
  assert.equal(matchesDispatchQuantities(
    [{ boxId: 'a', dispatchQuantity: 10 }, { boxId: 'b', dispatchQuantity: 5 }],
    [{ boxId: 'a', quantity: 10 }, { boxId: 'b', quantity: 5 }]
  ), true);
});

test('aggregates repeated lines before comparing quantities', () => {
  assert.equal(matchesDispatchQuantities(
    [{ boxId: 'a', dispatchQuantity: 7 }, { boxId: 'a', dispatchQuantity: 3 }],
    [{ boxId: 'a', quantity: 10 }]
  ), true);
});

test('rejects partial, omitted, excess and unrelated invoice quantities', () => {
  const dispatch = [{ boxId: 'a', dispatchQuantity: 10 }, { boxId: 'b', dispatchQuantity: 5 }];
  assert.equal(matchesDispatchQuantities(dispatch, [{ boxId: 'a', quantity: 8 }, { boxId: 'b', quantity: 5 }]), false);
  assert.equal(matchesDispatchQuantities(dispatch, [{ boxId: 'a', quantity: 10 }]), false);
  assert.equal(matchesDispatchQuantities(dispatch, [{ boxId: 'a', quantity: 10 }, { boxId: 'b', quantity: 6 }]), false);
  assert.equal(matchesDispatchQuantities(dispatch, [{ boxId: 'a', quantity: 10 }, { boxId: 'c', quantity: 5 }]), false);
});

test('rejects malformed or empty line arrays', () => {
  assert.equal(matchesDispatchQuantities([], []), false);
  assert.equal(matchesDispatchQuantities([{ boxId: 'a', dispatchQuantity: 0 }], [{ boxId: 'a', quantity: 0 }]), false);
});
