const mongoose = require('mongoose');
const companyScopePlugin = require('../utils/companyScope');

const cutSheetBatchSchema = new mongoose.Schema({
  companyKey: { type: String, enum: ['sk-packaging', 'nsb-industrial-solutions'], default: 'sk-packaging', index: true },
  batchNumber: { type: String, required: true, unique: true, trim: true },
  cutDate: { type: Date, required: true },
  lengthInches: { type: Number, required: true, min: 0.01 },
  widthInches: { type: Number, required: true, min: 0.01 },
  sheetCount: { type: Number, required: true, min: 1 },
  remainingSheets: { type: Number, required: true, min: 0 },
  totalWeightKg: { type: mongoose.Schema.Types.Decimal128, required: true },
  remainingWeightKg: { type: mongoose.Schema.Types.Decimal128, required: true },
  totalMaterialCost: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  unitCostPerKg: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  recoverableWasteKg: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  processLossKg: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  sourceReels: [{
    reelId: { type: mongoose.Schema.Types.ObjectId, ref: 'ReelUnit', required: true },
    reelCode: { type: String, required: true },
    weightConsumedKg: { type: mongoose.Schema.Types.Decimal128, required: true },
    landedRatePerKg: { type: mongoose.Schema.Types.Decimal128, default: 0 },
    materialCost: { type: mongoose.Schema.Types.Decimal128, default: 0 }
  }],
  notes: { type: String, trim: true, maxlength: 1000, default: '' },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['available', 'partially_used', 'consumed'], default: 'available' }
}, { timestamps: true });

cutSheetBatchSchema.index({ companyKey: 1, cutDate: -1 });
cutSheetBatchSchema.plugin(companyScopePlugin);
module.exports = mongoose.models.CutSheetBatch || mongoose.model('CutSheetBatch', cutSheetBatchSchema);
