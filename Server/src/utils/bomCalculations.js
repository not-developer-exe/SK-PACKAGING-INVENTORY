function calculateBomVariance({
  boxesProduced,
  sheetsPerBox,
  expectedKgPerBox,
  actualSheetsConsumed,
  actualWeightConsumedKg
}) {
  const values = [boxesProduced, sheetsPerBox, expectedKgPerBox, actualSheetsConsumed, actualWeightConsumedKg].map(Number);
  const [boxes, sheetsPerBoxValue, kgPerBox, actualSheets, actualKg] = values;
  if (!Number.isInteger(boxes) || boxes <= 0 ||
      !Number.isFinite(sheetsPerBoxValue) || sheetsPerBoxValue <= 0 ||
      !Number.isFinite(kgPerBox) || kgPerBox <= 0 ||
      !Number.isInteger(actualSheets) || actualSheets <= 0 ||
      !Number.isFinite(actualKg) || actualKg <= 0) {
    throw new TypeError('Production quantity, BOM values and actual consumption must be positive.');
  }
  const expectedSheets = Number((boxes * sheetsPerBoxValue).toFixed(4));
  const expectedWeightKg = Number((boxes * kgPerBox).toFixed(4));
  const sheetVariance = Number((actualSheets - expectedSheets).toFixed(4));
  const weightVarianceKg = Number((actualKg - expectedWeightKg).toFixed(4));
  const weightVariancePercent = Number(((weightVarianceKg / expectedWeightKg) * 100).toFixed(2));
  return { expectedSheets, expectedWeightKg, sheetVariance, weightVarianceKg, weightVariancePercent };
}

module.exports = { calculateBomVariance };
