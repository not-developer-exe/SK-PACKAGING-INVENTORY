const mongoose = require('mongoose');
const companyScopePlugin = require('../utils/companyScope');

// Thak is moisture-damaged paper weighed and entered separately from production scrap.
const thakEntrySchema = new mongoose.Schema({
  companyKey: { type: String, enum: ['sk-packaging', 'nsb-industrial-solutions'], default: 'sk-packaging', index: true },
  entryDate: { type: Date, required: true, default: Date.now },
  weightKg: { type: Number, required: true, min: 0.001 },
  notes: { type: String, trim: true, maxlength: 500, default: '' },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

thakEntrySchema.index({ entryDate: -1 });
thakEntrySchema.plugin(companyScopePlugin);

module.exports = mongoose.models.ThakEntry || mongoose.model('ThakEntry', thakEntrySchema);
