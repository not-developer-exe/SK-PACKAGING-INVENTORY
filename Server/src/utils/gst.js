function normalizeStateCode(value) {
  const code = String(value || '').trim().padStart(2, '0');
  return /^(0[1-9]|[12][0-9]|3[0-8]|97|99)$/.test(code) ? code : '';
}

function getCompanyStateCode(env = process.env) {
  const gstin = String(env.GSTIN || '').trim();
  return normalizeStateCode(env.GST_STATE_CODE || (gstin.length >= 2 ? gstin.slice(0, 2) : ''));
}

function calculateGstBreakdown({ taxableAmount, gstPercent, supplierStateCode, placeOfSupplyStateCode }) {
  const amount = Number(taxableAmount);
  const rate = Number(gstPercent);
  const supplier = normalizeStateCode(supplierStateCode);
  const place = normalizeStateCode(placeOfSupplyStateCode);
  if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(rate) || rate < 0 || rate > 40 || !supplier || !place) {
    throw new Error('Valid taxable amount, GST rate, supplier state code and place-of-supply state code are required.');
  }
  if (supplier === place) {
    const cgstAmount = Number((amount * rate / 200).toFixed(2));
    const sgstAmount = Number((amount * rate / 200).toFixed(2));
    return { taxType: 'CGST_SGST', cgstAmount, sgstAmount, igstAmount: 0 };
  }
  return {
    taxType: 'IGST',
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: Number((amount * rate / 100).toFixed(2))
  };
}

module.exports = { normalizeStateCode, getCompanyStateCode, calculateGstBreakdown };
