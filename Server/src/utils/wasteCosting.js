function calculateWasteMaterialCost({ totalMaterialCost, totalInputWeightKg, recoverableWasteKg, processLossKg }) {
  const cost = Number(totalMaterialCost);
  const input = Number(totalInputWeightKg);
  const recoverable = Number(recoverableWasteKg);
  const processLoss = Number(processLossKg);
  if (![cost, input, recoverable, processLoss].every(Number.isFinite) ||
      cost < 0 || input <= 0 || recoverable < 0 || processLoss < 0) {
    throw new TypeError('Waste costing requires finite non-negative costs and waste weights, with positive input weight.');
  }
  const materialCostPerInputKg = Number((cost / input).toFixed(6));
  return {
    materialCostPerInputKg,
    recoverableWasteMaterialCost: Number((recoverable * materialCostPerInputKg).toFixed(2)),
    processLossMaterialCost: Number((processLoss * materialCostPerInputKg).toFixed(2))
  };
}

module.exports = { calculateWasteMaterialCost };
