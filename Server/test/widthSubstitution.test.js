const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateWidthSubstitution } = require('../src/utils/widthSubstitution');

test('records a wider actual reel used in place of the requested width', () => {
  assert.deepEqual(calculateWidthSubstitution(24, 25), {
    requestedWidthInches: 24,
    actualWidthInches: 25,
    varianceInches: 1,
    isSubstitution: true,
    substitutionDirection: 'wider'
  });
});

test('records a narrower actual reel used in place of the requested width', () => {
  const result = calculateWidthSubstitution(25, 24.5);
  assert.equal(result.varianceInches, -0.5);
  assert.equal(result.substitutionDirection, 'narrower');
});

test('does not mark an exact width as a substitution', () => {
  assert.equal(calculateWidthSubstitution(24, 24).isSubstitution, false);
});

test('rejects invalid widths', () => {
  assert.throws(() => calculateWidthSubstitution(0, 24), /positive finite numbers/);
  assert.throws(() => calculateWidthSubstitution(24, Infinity), /positive finite numbers/);
});
