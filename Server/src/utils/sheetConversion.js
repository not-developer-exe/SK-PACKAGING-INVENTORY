function calculateSheetConsumption({ availableSheets, availableWeightKg, sheetsConsumed }) {
  const stockCount = Number(availableSheets);
  const stockWeight = Number(availableWeightKg);
  const requested = Number(sheetsConsumed);
  if (!Number.isInteger(stockCount) || stockCount < 0 ||
      !Number.isFinite(stockWeight) || stockWeight < 0 ||
      !Number.isInteger(requested) || requested <= 0) {
    throw new TypeError('Sheet stock and requested quantity must be valid non-negative values.');
  }
  if (requested > stockCount) {
    throw new RangeError('Insufficient sheets. Available: ' + stockCount + ', requested: ' + requested + '.');
  }
  if (stockCount === 0 || stockWeight === 0) {
    throw new RangeError('The selected sheet batch has no remaining weight or quantity.');
  }
  const weightPerSheet = stockWeight / stockCount;
  const consumedWeightKg = weightPerSheet * requested;
  const remainingSheets = stockCount - requested;
  const remainingWeightKg = remainingSheets === 0 ? 0 : stockWeight - consumedWeightKg;
  return {
    weightPerSheetKg: weightPerSheet,
    consumedWeightKg,
    remainingSheets,
    remainingWeightKg: Math.max(0, remainingWeightKg)
  };
}

module.exports = { calculateSheetConsumption };
