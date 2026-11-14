const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateLandedRatePerKg,
  resolveLandedRatePerKg,
  calculateMaterialCost,
  calculateUnitMaterialCost
} = require('../src/utils/materialCosting');

test('allocates freight and other inward charges across received reel weight', () => {
  assert.equal(calculateLandedRatePerKg({
    ratePerKg: 30,
    freightCharges: 2000,
    otherCharges: 500,
    totalWeightKg: 500
  }), 35);
});

test('falls back to base rate for legacy reels without landed-cost data', () => {
  assert.equal(resolveLandedRatePerKg(0, 31.5), 31.5);
  assert.equal(resolveLandedRatePerKg(36, 31.5), 36);
  assert.equal(resolveLandedRatePerKg(0, 0), 0);
});

test('calculates material cost from consumed weight and landed rate', () => {
  assert.equal(calculateMaterialCost(125.5, 35), 4392.5);
});

test('calculates unit cost per kg of produced sheets', () => {
  assert.equal(calculateUnitMaterialCost(10000, 800), 12.5);
});

test('rejects invalid landed cost and material measurements', () => {
  assert.throws(() => calculateLandedRatePerKg({
    ratePerKg: 30, freightCharges: -1, totalWeightKg: 100
  }), /finite, non-negative/);
  assert.throws(() => calculateMaterialCost(-1, 20), /finite and non-negative/);
  assert.throws(() => calculateUnitMaterialCost(100, 0), /output weight must be positive/);
});
