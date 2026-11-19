const mongoose = require('mongoose');
const companyScopePlugin = require('../utils/companyScope');
const financialTransactionSchema = new mongoose.Schema({
  companyKey: { type: String, enum: ['sk-packaging', 'nsb-industrial-solutions'], required: true, index: true },
  date: { type: Date, required: true },
  kind: { type: String, enum: ['income', 'expense', 'transfer'], required: true },
  amount: { type: Number, required: true, min: 0.01 },
  fromAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'FinancialAccount', default: null },
  toAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'FinancialAccount', default: null },
  category: { type: String, trim: true, maxlength: 100, default: '' },
  party: { type: String, trim: true, maxlength: 160, default: '' },
  description: { type: String, trim: true, maxlength: 500, default: '' },
  reference: { type: String, trim: true, maxlength: 120, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });
financialTransactionSchema.index({ companyKey: 1, date: -1, createdAt: -1 });
financialTransactionSchema.plugin(companyScopePlugin);
module.exports = mongoose.models.FinancialTransaction || mongoose.model('FinancialTransaction', financialTransactionSchema);
