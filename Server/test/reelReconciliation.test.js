const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateReelReconciliation } = require('../src/utils/reelReconciliation');

test('calculates a negative variance when physical stock is lower', () => {
  const result = calculateReelReconciliation({ originalWeightKg: 200, systemWeightKg: 120, countedWeightKg: 117.5 });
  assert.equal(result.varianceKg, -2.5);
  assert.equal(result.status, 'partial');
});

test('calculates a positive variance when physical stock is higher', () => {
  const result = calculateReelReconciliation({ originalWeightKg: 200, systemWeightKg: 120, countedWeightKg: 125 });
  assert.equal(result.varianceKg, 5);
  assert.equal(result.status, 'partial');
});

test('accepts unchanged physical stock with zero variance', () => {
  const result = calculateReelReconciliation({ originalWeightKg: 200, systemWeightKg: 120, countedWeightKg: 120 });
  assert.equal(result.varianceKg, 0);
  assert.equal(result.status, 'partial');
});

test('marks a zero physical weight as consumed', () => {
  const result = calculateReelReconciliation({ originalWeightKg: 200, systemWeightKg: 20, countedWeightKg: 0 });
  assert.equal(result.varianceKg, -20);
  assert.equal(result.status, 'consumed');
});

test('rejects physical weight greater than original reel weight', () => {
  assert.throws(() => calculateReelReconciliation({ originalWeightKg: 200, systemWeightKg: 120, countedWeightKg: 201 }), /cannot exceed/i);
});

test('rejects invalid weight values', () => {
  assert.throws(() => calculateReelReconciliation({ originalWeightKg: 200, systemWeightKg: -1, countedWeightKg: 50 }), /finite and non-negative/i);
});
