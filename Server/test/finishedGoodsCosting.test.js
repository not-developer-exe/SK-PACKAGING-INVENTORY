const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateFinishedGoodsCost } = require('../src/utils/finishedGoodsCosting');

test('aggregates sheet, raw material and conversion costs into batch and per-box cost', () => {
  assert.deepEqual(calculateFinishedGoodsCost({ sheetMaterialCost: 12000, rawMaterialCost: 850, labourCost: 1200, otherConversionCost: 250, quantityProduced: 1000 }), {
    sheetMaterialCost: 12000, rawMaterialCost: 850, labourCost: 1200, otherConversionCost: 250,
    totalConversionCost: 1450, totalCost: 14300, costPerBox: 14.3
  });
});
test('supports zero optional costs', () => {
  const result = calculateFinishedGoodsCost({ sheetMaterialCost: 500, quantityProduced: 50 });
  assert.equal(result.totalCost, 500);
  assert.equal(result.costPerBox, 10);
});
test('rejects negative, non-finite and invalid quantities', () => {
  assert.throws(() => calculateFinishedGoodsCost({ sheetMaterialCost: -1, quantityProduced: 1 }), /non-negative/);
  assert.throws(() => calculateFinishedGoodsCost({ labourCost: Infinity, quantityProduced: 1 }), /non-negative/);
  assert.throws(() => calculateFinishedGoodsCost({ quantityProduced: 0 }), /positive whole number/);
});
