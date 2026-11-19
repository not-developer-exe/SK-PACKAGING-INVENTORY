const mongoose = require('mongoose');
const companyScopePlugin = require('../utils/companyScope');
const financialAccountSchema = new mongoose.Schema({
  companyKey: { type: String, enum: ['sk-packaging', 'nsb-industrial-solutions'], required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  type: { type: String, enum: ['bank', 'cash'], required: true },
  openingBalance: { type: Number, required: true, min: 0, default: 0 },
  currentBalance: { type: Number, required: true, min: 0, default: 0 },
  bankName: { type: String, trim: true, maxlength: 120, default: '' },
  accountHolder: { type: String, trim: true, maxlength: 120, default: '' },
  accountNumber: { type: String, trim: true, maxlength: 40, default: '' },
  ifsc: { type: String, trim: true, uppercase: true, maxlength: 11, default: '' },
  branch: { type: String, trim: true, maxlength: 120, default: '' },
  branchAddress: { type: String, trim: true, maxlength: 500, default: '' },
  bankCity: { type: String, trim: true, maxlength: 100, default: '' },
  bankState: { type: String, trim: true, maxlength: 100, default: '' },
  upiId: { type: String, trim: true, maxlength: 100, default: '' },
  isDefaultForInvoice: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });
financialAccountSchema.index({ companyKey: 1, name: 1 }, { unique: true });
financialAccountSchema.plugin(companyScopePlugin);
module.exports = mongoose.models.FinancialAccount || mongoose.model('FinancialAccount', financialAccountSchema);
