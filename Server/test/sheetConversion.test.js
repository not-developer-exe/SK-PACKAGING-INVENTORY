const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateSheetConsumption } = require('../src/utils/sheetConversion');

test('consumes a proportional weight and preserves remaining sheet stock', () => {
  assert.deepEqual(calculateSheetConsumption({
    availableSheets: 100,
    availableWeightKg: 250,
    sheetsConsumed: 20
  }), {
    weightPerSheetKg: 2.5,
    consumedWeightKg: 50,
    remainingSheets: 80,
    remainingWeightKg: 200
  });
});

test('uses all remaining weight when the final sheets are consumed', () => {
  const result = calculateSheetConsumption({
    availableSheets: 3,
    availableWeightKg: 1,
    sheetsConsumed: 3
  });
  assert.equal(result.remainingSheets, 0);
  assert.equal(result.remainingWeightKg, 0);
  assert.equal(result.consumedWeightKg, 1);
});

test('rejects conversion beyond available sheets', () => {
  assert.throws(() => calculateSheetConsumption({
    availableSheets: 10,
    availableWeightKg: 25,
    sheetsConsumed: 11
  }), /Insufficient sheets/);
});

test('rejects invalid or empty stock', () => {
  assert.throws(() => calculateSheetConsumption({
    availableSheets: 0,
    availableWeightKg: 0,
    sheetsConsumed: 1
  }), /no remaining weight or quantity/);
  assert.throws(() => calculateSheetConsumption({
    availableSheets: 10,
    availableWeightKg: 25,
    sheetsConsumed: 1.5
  }), /valid non-negative values/);
});
