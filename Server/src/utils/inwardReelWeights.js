function normalizeInwardReelWeights({ reelCount, totalWeightKg, reelWeightsKg }) {
  const count = Number(reelCount);
  const total = Number(totalWeightKg);
  if (!Number.isInteger(count) || count <= 0 || !Number.isFinite(total) || total <= 0) {
    throw new TypeError('Reel count must be a positive whole number and total weight must be positive.');
  }

  if (reelWeightsKg !== undefined && reelWeightsKg !== null && !Array.isArray(reelWeightsKg)) {
    throw new TypeError('Individual reel weights must be provided as a list.');
  }

  const supplied = Array.isArray(reelWeightsKg) ? reelWeightsKg : [];
  if (supplied.length > 0) {
    if (supplied.length !== count) {
      throw new TypeError('Enter one individual weight for every reel, or leave the field blank to use aggregate weight.');
    }
    const weights = supplied.map(Number);
    if (weights.some((weight) => !Number.isFinite(weight) || weight <= 0)) {
      throw new TypeError('Every individual reel weight must be a positive number.');
    }
    const sum = weights.reduce((value, weight) => value + weight, 0);
    if (Math.abs(sum - total) > 0.01) {
      throw new TypeError('The sum of individual reel weights must match total inward weight within 0.01 kg.');
    }
    return { reelWeightsKg: weights, isAggregateWeightOnly: false };
  }

  const average = total / count;
  const weights = Array.from({ length: count }, (_, index) =>
    index === count - 1 ? total - average * (count - 1) : average
  );
  return { reelWeightsKg: weights, isAggregateWeightOnly: true };
}

module.exports = { normalizeInwardReelWeights };
