function calculateLandedRatePerKg({ ratePerKg, freightCharges = 0, otherCharges = 0, totalWeightKg }) {
  const rate = Number(ratePerKg);
  const freight = Number(freightCharges);
  const other = Number(otherCharges);
  const weight = Number(totalWeightKg);
  if (![rate, freight, other, weight].every(Number.isFinite) ||
      rate < 0 || freight < 0 || other < 0 || weight <= 0) {
    throw new TypeError('Landed cost inputs must be finite, non-negative values with positive total weight.');
  }
  return Number((rate + (freight + other) / weight).toFixed(6));
}

function resolveLandedRatePerKg(landedRatePerKg, baseRatePerKg) {
  const landed = Number(landedRatePerKg);
  const base = Number(baseRatePerKg);
  if (!Number.isFinite(landed) || landed < 0 || !Number.isFinite(base) || base < 0) {
    throw new TypeError('Landed and base rates must be finite and non-negative.');
  }
  // Legacy reel records predate landedRatePerKg; a missing/default zero landed rate
  // must not erase their recorded base purchase rate.
  return landed > 0 || base === 0 ? landed : base;
}

function calculateMaterialCost(weightKg, ratePerKg) {
  const weight = Number(weightKg);
  const rate = Number(ratePerKg);
  if (!Number.isFinite(weight) || weight < 0 || !Number.isFinite(rate) || rate < 0) {
    throw new TypeError('Material weight and rate must be finite and non-negative.');
  }
  return Number((weight * rate).toFixed(2));
}

function calculateUnitMaterialCost(totalMaterialCost, outputWeightKg) {
  const cost = Number(totalMaterialCost);
  const weight = Number(outputWeightKg);
  if (!Number.isFinite(cost) || cost < 0 || !Number.isFinite(weight) || weight <= 0) {
    throw new TypeError('Total material cost must be non-negative and output weight must be positive.');
  }
  return Number((cost / weight).toFixed(6));
}

module.exports = { calculateLandedRatePerKg, resolveLandedRatePerKg, calculateMaterialCost, calculateUnitMaterialCost };
