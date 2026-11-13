function toNonNegativeNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new TypeError(label + ' must be a finite, non-negative number.');
  }
  return number;
}

function calculateProductionBalance(totalInputWeightKg, totalOutputWeightKg, recoverableWasteKg) {
  const input = toNonNegativeNumber(totalInputWeightKg, 'Input weight');
  const output = toNonNegativeNumber(totalOutputWeightKg, 'Output weight');
  const recoverable = toNonNegativeNumber(recoverableWasteKg, 'Recoverable scrap');

  if (output > input) {
    throw new RangeError('Output sheet weight cannot exceed total input reel weight.');
  }

  const massDifferenceKg = input - output;
  if (recoverable > massDifferenceKg) {
    throw new RangeError('Measured recoverable scrap cannot exceed the input-output weight difference.');
  }

  return {
    totalInputWeightKg: input,
    totalOutputWeightKg: output,
    recoverableWasteKg: recoverable,
    processLossKg: massDifferenceKg - recoverable
  };
}

function calculateScrapAvailability(totalVerifiedGeneratedKg, totalSoldKg) {
  const generated = toNonNegativeNumber(totalVerifiedGeneratedKg, 'Verified scrap generated');
  const sold = toNonNegativeNumber(totalSoldKg, 'Scrap sold');
  // Negative balances are intentional: they expose historical overselling.
  return generated - sold;
}

module.exports = {
  calculateProductionBalance,
  calculateScrapAvailability
};
