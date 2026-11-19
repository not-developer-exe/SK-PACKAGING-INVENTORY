const CompanyProfile = require('../models/CompanyProfile.model');
const writeAuditLog = require('../utils/writeAuditLog');
const VALID = ['sk-packaging','nsb-industrial-solutions'];
const getKey = (req) => VALID.includes(req.companyKey) ? req.companyKey : 'sk-packaging';
const normalizeState = (value) => {
  const code = String(value || '').trim().padStart(2, '0');
  return /^(0[1-9]|[12][0-9]|3[0-8]|97|99)$/.test(code) ? code : '';
};
exports.getCompanyProfile = async (req,res) => {
  try {
    const key = getKey(req);
    let profile = await CompanyProfile.findOne({ companyKey:key }).lean();
    if (!profile) {
      const gstin = key === 'nsb-industrial-solutions' ? process.env.NSB_GSTIN : (process.env.SK_GSTIN || process.env.GSTIN);
      const stateCode = key === 'nsb-industrial-solutions' ? process.env.NSB_GST_STATE_CODE : (process.env.SK_GST_STATE_CODE || process.env.GST_STATE_CODE);
      profile = { companyKey:key, gstin:gstin || '', stateCode:normalizeState(stateCode || String(gstin || '').slice(0,2)), invoicePrefix:key === 'nsb-industrial-solutions' ? (process.env.NSB_INVOICE_PREFIX || 'NSB') : (process.env.SK_INVOICE_PREFIX || 'SK') };
    }
    return res.json({ profile });
  } catch (error) { return res.status(500).json({ message:'Unable to load company profile.' }); }
};
exports.saveCompanyProfile = async (req,res) => {
  const body = req.body || {};
  const gstin = String(body.gstin || '').trim().toUpperCase();
  if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) return res.status(400).json({ message:'Enter a valid 15-character GSTIN.' });
  const stateCode = normalizeState(body.stateCode || gstin.slice(0,2));
  if (body.stateCode && !stateCode) return res.status(400).json({ message:'Enter a valid two-digit GST state code.' });
  if (gstin && stateCode && gstin.slice(0,2) !== stateCode) return res.status(400).json({ message:'GSTIN state code and selected state code do not match.' });
  if (body.pincode && !/^\d{6}$/.test(String(body.pincode))) return res.status(400).json({ message:'PIN code must contain six digits.' });
  if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.email))) return res.status(400).json({ message:'Enter a valid email address.' });
  const fields = ['legalName','tradeName','registeredAddress','city','stateName','pincode','phone','email','invoicePrefix','signatoryName','invoiceTerms','logoUrl'];
  const values = { gstin, stateCode };
  for (const field of fields) values[field] = String(body[field] || '').trim();
  values.invoicePrefix = values.invoicePrefix.toUpperCase();
  if (!values.invoicePrefix) values.invoicePrefix = getKey(req) === 'nsb-industrial-solutions' ? 'NSB' : 'SK';
  try {
    const key = getKey(req);
    const profile = await CompanyProfile.findOneAndUpdate({ companyKey:key }, { $set:values, $setOnInsert:{ companyKey:key } }, { new:true, upsert:true, runValidators:true });
    await writeAuditLog(req, { action:'company.profile.updated', entityType:'CompanyProfile', entityId:profile._id, entityLabel:profile.legalName || key, summary:'Company profile updated for '+key }, null);
    return res.json({ message:'Company profile saved.', profile });
  } catch (error) { return res.status(400).json({ message:'Unable to save company profile.' }); }
};
