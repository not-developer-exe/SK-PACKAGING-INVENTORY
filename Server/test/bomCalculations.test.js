const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateBomVariance } = require('../src/utils/bomCalculations');

test('calculates expected sheets and kilograms for a production quantity', () => {
  const result = calculateBomVariance({
    boxesProduced: 1000,
    sheetsPerBox: 1.25,
    expectedKgPerBox: 0.82,
    actualSheetsConsumed: 1300,
    actualWeightConsumedKg: 850
  });
  assert.equal(result.expectedSheets, 1250);
  assert.equal(result.sheetVariance, 50);
  assert.equal(result.expectedWeightKg, 820);
  assert.equal(result.weightVarianceKg, 30);
  assert.equal(result.weightVariancePercent, 3.66);
});

test('reports favourable negative variance and exact match', () => {
  const result = calculateBomVariance({
    boxesProduced: 10,
    sheetsPerBox: 1,
    expectedKgPerBox: 0.5,
    actualSheetsConsumed: 10,
    actualWeightConsumedKg: 5
  });
  assert.equal(result.sheetVariance, 0);
  assert.equal(result.weightVarianceKg, 0);
  assert.equal(result.weightVariancePercent, 0);
});

test('rejects invalid quantities and BOM values', () => {
  assert.throws(() => calculateBomVariance({
    boxesProduced: 0, sheetsPerBox: 1, expectedKgPerBox: 0.5,
    actualSheetsConsumed: 10, actualWeightConsumedKg: 5
  }), /positive/);
});
