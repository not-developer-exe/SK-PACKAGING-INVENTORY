const mongoose = require('mongoose');

const consumedReelSchema = new mongoose.Schema({
  reelId: { type: mongoose.Schema.Types.ObjectId, ref: 'ReelUnit', required: true },
  reelCode: { type: String, trim: true },
  requestedWidthInches: { type: Number, min: 0 },
  actualWidthInches: { type: Number, min: 0 },
  widthVarianceInches: { type: Number },
  bf: { type: Number },
  gsm: { type: Number },
  quality: { type: String, enum: ['Natural', 'GY'] },
  landedRatePerKg: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  materialCost: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  weightConsumedKg: { type: mongoose.Schema.Types.Decimal128, required: true }
});

const productionRunSchema = new mongoose.Schema({
  runNumber: { type: String, required: true, unique: true, trim: true },
  runDate: { type: Date, required: true, default: Date.now },
  shift: { type: String, enum: ['Day', 'Night'], default: 'Day' },
  operatorName: { type: String, trim: true },
  inputReels: [consumedReelSchema],
  totalInputWeightKg: { type: mongoose.Schema.Types.Decimal128, required: true },
  totalOutputWeightKg: { type: mongoose.Schema.Types.Decimal128, required: true },
  totalMaterialCost: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  materialCostPerOutputKg: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  // Only physically measured, recoverable scrap is saleable waste inventory.
  recoverableWasteKg: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  // Input/output variance not accounted for by sheets or measured recoverable scrap.
  processLossKg: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  // Kept for compatibility; new records store recoverable scrap here.
  wasteGeneratedKg: { type: mongoose.Schema.Types.Decimal128, required: true },
  status: { type: String, enum: ['draft', 'completed'], default: 'draft' },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

productionRunSchema.index({ runDate: -1 });

module.exports = mongoose.model('ProductionRun', productionRunSchema);
