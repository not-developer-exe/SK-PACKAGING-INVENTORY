const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeInwardReelWeights } = require('../src/utils/inwardReelWeights');

test('preserves individual physical reel weights when their sum matches the inward total', () => {
  const result = normalizeInwardReelWeights({
    reelCount: 3,
    totalWeightKg: 451.5,
    reelWeightsKg: [150, 151.25, 150.25]
  });
  assert.deepEqual(result.reelWeightsKg, [150, 151.25, 150.25]);
  assert.equal(result.isAggregateWeightOnly, false);
});

test('splits aggregate weight evenly and flags the estimate explicitly', () => {
  const result = normalizeInwardReelWeights({ reelCount: 3, totalWeightKg: 100 });
  assert.equal(result.isAggregateWeightOnly, true);
  assert.equal(result.reelWeightsKg.length, 3);
  assert.ok(Math.abs(result.reelWeightsKg.reduce((sum, weight) => sum + weight, 0) - 100) < 1e-9);
});

test('uses the individual reel total as the canonical stock weight within the rounding tolerance', () => {
  const result = normalizeInwardReelWeights({
    reelCount: 2, totalWeightKg: 100, reelWeightsKg: [49.995, 50]
  });
  assert.equal(result.totalWeightKg, 99.995);
});

test('rejects an individual weight list with the wrong number of reels', () => {
  assert.throws(() => normalizeInwardReelWeights({
    reelCount: 2, totalWeightKg: 100, reelWeightsKg: [50]
  }), /one individual weight for every reel/i);
});

test('rejects individual weights that do not reconcile to the total', () => {
  assert.throws(() => normalizeInwardReelWeights({
    reelCount: 2, totalWeightKg: 100, reelWeightsKg: [45, 54]
  }), /sum of individual reel weights/i);
});

test('rejects zero, negative and non-finite individual weights', () => {
  for (const weights of [[50, 0], [50, -1], [50, 'abc']]) {
    assert.throws(() => normalizeInwardReelWeights({
      reelCount: 2, totalWeightKg: 100, reelWeightsKg: weights
    }), /positive number/i);
  }
});

test('rejects invalid aggregate count or weight', () => {
  assert.throws(() => normalizeInwardReelWeights({ reelCount: 1.5, totalWeightKg: 100 }), /positive whole number/i);
  assert.throws(() => normalizeInwardReelWeights({ reelCount: 2, totalWeightKg: 0 }), /positive whole number/i);
});
