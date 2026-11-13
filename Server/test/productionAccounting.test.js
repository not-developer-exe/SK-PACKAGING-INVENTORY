const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateProductionBalance,
  calculateScrapAvailability
} = require('../src/utils/productionAccounting');

test('separates recoverable scrap from remaining process loss', () => {
  const result = calculateProductionBalance(100, 92, 5);
  assert.deepEqual(result, {
    totalInputWeightKg: 100,
    totalOutputWeightKg: 92,
    recoverableWasteKg: 5,
    processLossKg: 3
  });
});

test('rejects output weight greater than input weight', () => {
  assert.throws(() => calculateProductionBalance(90, 91, 0), {
    name: 'RangeError',
    message: 'Output sheet weight cannot exceed total input reel weight.'
  });
});

test('rejects recoverable scrap greater than the measured mass difference', () => {
  assert.throws(() => calculateProductionBalance(100, 95, 5.1), {
    name: 'RangeError',
    message: 'Measured recoverable scrap cannot exceed the input-output weight difference.'
  });
});

test('supports fractional kilogram measurements', () => {
  const result = calculateProductionBalance(100.25, 90.1, 1.15);
  assert.ok(Math.abs(result.processLossKg - 9) < 1e-9);
});

test('preserves a negative scrap balance instead of hiding historical overselling', () => {
  assert.equal(calculateScrapAvailability(12, 14), -2);
});

test('rejects non-finite and negative measurements', () => {
  assert.throws(() => calculateProductionBalance(100, 90, NaN), TypeError);
  assert.throws(() => calculateScrapAvailability(10, -1), TypeError);
});
