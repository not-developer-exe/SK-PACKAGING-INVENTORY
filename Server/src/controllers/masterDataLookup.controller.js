const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const STATE_NAMES = { '01':'Jammu and Kashmir','02':'Himachal Pradesh','03':'Punjab','04':'Chandigarh','05':'Uttarakhand','06':'Haryana','07':'Delhi','08':'Rajasthan','09':'Uttar Pradesh','10':'Bihar','11':'Sikkim','12':'Arunachal Pradesh','13':'Nagaland','14':'Manipur','15':'Mizoram','16':'Tripura','17':'Meghalaya','18':'Assam','19':'West Bengal','20':'Jharkhand','21':'Odisha','22':'Chhattisgarh','23':'Madhya Pradesh','24':'Gujarat','26':'Dadra and Nagar Haveli and Daman and Diu','27':'Maharashtra','28':'Andhra Pradesh (Old)','29':'Karnataka','30':'Goa','31':'Lakshadweep','32':'Kerala','33':'Tamil Nadu','34':'Puducherry','35':'Andaman and Nicobar Islands','36':'Telangana','37':'Andhra Pradesh','38':'Ladakh','97':'Other Territory' };

exports.lookupIfsc = async (req, res) => {
  const ifsc = String(req.params.ifsc || '').trim().toUpperCase();
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) return res.status(400).json({ message: 'Enter a valid 11-character IFSC code.' });
  try {
    const response = await fetch('https://ifsc.razorpay.com/' + encodeURIComponent(ifsc), { signal: AbortSignal.timeout(7000), headers: { Accept: 'application/json' } });
    if (response.status === 404) return res.status(404).json({ message: 'No bank branch was found for this IFSC. Please check the code.' });
    if (!response.ok) return res.status(502).json({ message: 'Bank lookup service is temporarily unavailable. You can enter the details manually.' });
    const data = await response.json();
    return res.json({ bankDetails: { ifsc, bankName: data.BANK || '', branch: data.BRANCH || '', address: data.ADDRESS || '', city: data.CITY || '', district: data.DISTRICT || '', state: data.STATE || '', contact: data.CONTACT || '', micr: data.MICR || '' }, source: 'Razorpay IFSC directory' });
  } catch (error) {
    return res.status(502).json({ message: 'Could not reach the bank lookup service. You can enter the details manually.' });
  }
};

exports.lookupGstin = async (req, res) => {
  const gstin = String(req.params.gstin || '').trim().toUpperCase();
  if (!GSTIN_PATTERN.test(gstin) || !STATE_NAMES[gstin.slice(0, 2)]) return res.status(400).json({ message: 'Enter a GSTIN in the correct 15-character format.' });
  const template = process.env.GSTIN_LOOKUP_URL_TEMPLATE;
  const apiKey = process.env.GSTIN_LOOKUP_API_KEY;
  if (!template || !apiKey) return res.status(503).json({ message: 'GST taxpayer lookup is not connected yet. Add an authorised GST Suvidha Provider API URL and key to the server environment. GSTIN format and state code are valid, but the taxpayer name/address have not been verified.' });
  try {
    const url = template.replace('{gstin}', encodeURIComponent(gstin));
    const response = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { Accept: 'application/json', 'x-api-key': apiKey } });
    if (!response.ok) return res.status(response.status === 404 ? 404 : 502).json({ message: response.status === 404 ? 'GSTIN was not found by the provider.' : 'GST taxpayer lookup failed. Please verify manually.' });
    const payload = await response.json();
    const data = payload.data || payload;
    const address = data.pradr?.adr || data.principalPlaceOfBusiness || data.address || {};
    const details = {
      gstin,
      legalName: data.lgnm || data.legalName || data.legal_name || '',
      tradeName: data.tradeNam || data.tradeName || data.trade_name || '',
      registrationStatus: data.sts || data.status || data.registrationStatus || '',
      address: [address.bno, address.flno, address.bnm, address.st, address.loc, address.dst, address.stcd, address.pncd].filter(Boolean).join(', ') || (typeof address === 'string' ? address : ''),
      city: address.dst || address.loc || data.city || '',
      stateCode: gstin.slice(0, 2),
      stateName: STATE_NAMES[gstin.slice(0, 2)],
      pincode: address.pncd || data.pincode || ''
    };
    if (!details.legalName && !details.tradeName && !details.address) return res.status(502).json({ message: 'The GST provider returned no usable taxpayer details. Please verify manually.' });
    return res.json({ taxpayer: details, source: 'Authorised GST lookup provider' });
  } catch (error) {
    return res.status(502).json({ message: 'Could not reach the GST lookup provider. Please verify manually.' });
  }
};
