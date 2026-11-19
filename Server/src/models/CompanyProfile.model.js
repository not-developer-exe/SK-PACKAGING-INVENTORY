const mongoose = require('mongoose');
const companyProfileSchema = new mongoose.Schema({
  companyKey: { type: String, enum: ['sk-packaging','nsb-industrial-solutions'], required: true, unique: true },
  legalName: { type: String, trim: true, maxlength: 160, default: '' },
  tradeName: { type: String, trim: true, maxlength: 160, default: '' },
  gstin: { type: String, trim: true, uppercase: true, maxlength: 15, default: '' },
  stateCode: { type: String, trim: true, maxlength: 2, default: '' },
  registeredAddress: { type: String, trim: true, maxlength: 500, default: '' },
  city: { type: String, trim: true, maxlength: 100, default: '' },
  stateName: { type: String, trim: true, maxlength: 100, default: '' },
  pincode: { type: String, trim: true, maxlength: 6, default: '' },
  phone: { type: String, trim: true, maxlength: 20, default: '' },
  email: { type: String, trim: true, lowercase: true, maxlength: 160, default: '' },
  invoicePrefix: { type: String, trim: true, uppercase: true, maxlength: 10, default: '' },
  signatoryName: { type: String, trim: true, maxlength: 120, default: '' },
  invoiceTerms: { type: String, trim: true, maxlength: 2000, default: '' },
  logoUrl: { type: String, trim: true, maxlength: 1000, default: '' }
}, { timestamps: true });
module.exports = mongoose.models.CompanyProfile || mongoose.model('CompanyProfile', companyProfileSchema);
