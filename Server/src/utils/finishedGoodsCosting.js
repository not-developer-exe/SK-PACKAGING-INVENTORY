function calculateFinishedGoodsCost({ sheetMaterialCost = 0, rawMaterialCost = 0, labourCost = 0, otherConversionCost = 0, quantityProduced }) {
  const values = [sheetMaterialCost, rawMaterialCost, labourCost, otherConversionCost].map(Number);
  const quantity = Number(quantityProduced);
  if (!values.every(value => Number.isFinite(value) && value >= 0) || !Number.isInteger(quantity) || quantity <= 0) {
    throw new TypeError('Finished-goods costs must be finite, non-negative values and quantity produced must be a positive whole number.');
  }
  const [sheet, raw, labour, other] = values;
  const totalConversionCost = Number((labour + other).toFixed(2));
  const totalCost = Number((sheet + raw + totalConversionCost).toFixed(2));
  return { sheetMaterialCost: sheet, rawMaterialCost: raw, labourCost: labour, otherConversionCost: other, totalConversionCost, totalCost, costPerBox: Number((totalCost / quantity).toFixed(2)) };
}
module.exports = { calculateFinishedGoodsCost };
