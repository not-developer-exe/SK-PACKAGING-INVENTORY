const mongoose = require('mongoose');

const companyScopePlugin = require('../utils/companyScope');
const openingStockLineSchema = new mongoose.Schema({
  reelWidthInches: { type: Number, required: true },
  bf: { type: Number, required: true },
  gsm: { type: Number, required: true },
  quality: { type: String, enum: ['Natural', 'GY'], required: true },
  reelWeightsKg: [{ type: Number, required: true, min: 0.001 }],
  weightSource: { type: String, enum: ['estimated', 'verified'], default: 'verified' },
  ratePerKg: { type: mongoose.Schema.Types.Decimal128, required: true },
  reelIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ReelUnit' }]
});

const openingStockAdjustmentSchema = new mongoose.Schema({
  companyKey: { type: String, enum: ['sk-packaging', 'nsb-industrial-solutions'], default: 'sk-packaging', index: true },
  adjustmentNumber: { type: String, required: true, unique: true, trim: true },
  adjustmentDate: { type: Date, required: true, default: Date.now },
  reason: { type: String, required: true, trim: true },
  lines: { type: [openingStockLineSchema], required: true },
  totalReels: { type: Number, required: true, min: 1 },
  totalWeightKg: { type: mongoose.Schema.Types.Decimal128, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

openingStockAdjustmentSchema.index({ adjustmentDate: -1 });

openingStockLineSchema.plugin(companyScopePlugin);

module.exports = mongoose.model('OpeningStockAdjustment', openingStockAdjustmentSchema);
