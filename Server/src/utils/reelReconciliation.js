function calculateReelReconciliation({ originalWeightKg, systemWeightKg, countedWeightKg }) {
  const original = Number(originalWeightKg);
  const system = Number(systemWeightKg);
  const counted = Number(countedWeightKg);
  if (![original, system, counted].every(Number.isFinite) || original <= 0 || system < 0 || counted < 0) {
    throw new Error('Reel weights must be finite and non-negative, with a positive original weight.');
  }
  if (system > original || counted > original) {
    throw new Error('Remaining or counted weight cannot exceed original reel weight.');
  }
  return {
    varianceKg: counted - system,
    status: counted === 0 ? 'consumed' : counted < original ? 'partial' : 'available'
  };
}

module.exports = { calculateReelReconciliation };
