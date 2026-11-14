function calculateWidthSubstitution(requestedWidthInches, actualWidthInches) {
  const requested = Number(requestedWidthInches);
  const actual = Number(actualWidthInches);
  if (!Number.isFinite(requested) || requested <= 0 ||
      !Number.isFinite(actual) || actual <= 0) {
    throw new TypeError('Requested and actual reel widths must be positive finite numbers.');
  }
  const varianceInches = Number((actual - requested).toFixed(4));
  return {
    requestedWidthInches: requested,
    actualWidthInches: actual,
    varianceInches,
    isSubstitution: Math.abs(varianceInches) > 0.0001,
    substitutionDirection: varianceInches > 0 ? 'wider' : varianceInches < 0 ? 'narrower' : 'exact'
  };
}

module.exports = { calculateWidthSubstitution };
