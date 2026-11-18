const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeStateCode, getCompanyStateCode, calculateGstBreakdown } = require('../src/utils/gst');

test('normalizes valid Indian GST state codes and rejects invalid values', () => {
  assert.equal(normalizeStateCode('23'), '23');
  assert.equal(normalizeStateCode('3'), '03');
  assert.equal(normalizeStateCode('99'), '99');
  assert.equal(normalizeStateCode('00'), '');
  assert.equal(normalizeStateCode('39'), '');
  assert.equal(normalizeStateCode('MP'), '');
});

test('derives company state code from explicit config or GSTIN prefix', () => {
  assert.equal(getCompanyStateCode({ GST_STATE_CODE: '23', GSTIN: '27ABCDE1234F1Z5' }), '23');
  assert.equal(getCompanyStateCode({ GSTIN: '23ABCDE1234F1Z5' }), '23');
  assert.equal(getCompanyStateCode({}), '');
});

test('calculates intra-state CGST and SGST separately with matching rounding', () => {
  assert.deepEqual(calculateGstBreakdown({
    taxableAmount: 10000,
    gstPercent: 18,
    supplierStateCode: '23',
    placeOfSupplyStateCode: '23'
  }), { taxType: 'CGST_SGST', cgstAmount: 900, sgstAmount: 900, igstAmount: 0 });
});

test('calculates inter-state IGST only', () => {
  assert.deepEqual(calculateGstBreakdown({
    taxableAmount: 10000,
    gstPercent: 18,
    supplierStateCode: '23',
    placeOfSupplyStateCode: '27'
  }), { taxType: 'IGST', cgstAmount: 0, sgstAmount: 0, igstAmount: 1800 });
});
