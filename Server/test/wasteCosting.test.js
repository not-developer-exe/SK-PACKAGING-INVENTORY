const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateWasteMaterialCost } = require('../src/utils/wasteCosting');

test('allocates actual run material cost over consumed input weight', () => {
  assert.deepEqual(calculateWasteMaterialCost({
    totalMaterialCost: 40000, totalInputWeightKg: 800, recoverableWasteKg: 18, processLossKg: 12
  }), {
    materialCostPerInputKg: 50,
    recoverableWasteMaterialCost: 900,
    processLossMaterialCost: 600
  });
});

test('rounds the allocated scrap value to paise', () => {
  const result = calculateWasteMaterialCost({
    totalMaterialCost: 1234.56, totalInputWeightKg: 333, recoverableWasteKg: 2.5, processLossKg: 1
  });
  assert.equal(result.recoverableWasteMaterialCost, 9.27);
});

test('rejects invalid weights and costs', () => {
  assert.throws(() => calculateWasteMaterialCost({
    totalMaterialCost: 10, totalInputWeightKg: 0, recoverableWasteKg: 1, processLossKg: 0
  }), /positive input weight/);
  assert.throws(() => calculateWasteMaterialCost({
    totalMaterialCost: -1, totalInputWeightKg: 10, recoverableWasteKg: 1, processLossKg: 0
  }), /finite non-negative/);
});
