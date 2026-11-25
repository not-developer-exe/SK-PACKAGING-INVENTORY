const mongoose = require('mongoose');
const companyScopePlugin = require('../utils/companyScope');

// Thak is moisture-damaged paper weighed and entered separately from production scrap.
const thakEntrySchema = new mongoose.Schema({
  companyKey: { type: String, enum: ['sk-packaging', 'nsb-industrial-solutions'], default: 'sk-packaging', index: true },
  entryDate: { type: Date, required: true, default: Date.now },
  entryType: { type: String, enum: ['production', 'opening_balance'], default: 'production', index: true },
  weightKg: { type: Number, required: true, min: 0.001 },
  ratePerKg: { type: Number, default: 0, min: 0 },
  totalValue: { type: Number, default: 0, min: 0 },
  notes: { type: String, trim: true, maxlength: 500, default: '' },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

thakEntrySchema.index({ entryDate: -1 });
thakEntrySchema.index({ companyKey: 1, entryType: 1 }, { unique: true, partialFilterExpression: { entryType: 'opening_balance' } });
thakEntrySchema.plugin(companyScopePlugin);

module.exports = mongoose.models.ThakEntry || mongoose.model('ThakEntry', thakEntrySchema);
