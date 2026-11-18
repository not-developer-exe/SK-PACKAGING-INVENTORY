const mongoose = require('mongoose');

const companyScopePlugin = require('../utils/companyScope');
const consumedReelSchema = new mongoose.Schema({
  companyKey: { type: String, enum: ['sk-packaging', 'nsb-industrial-solutions'], default: 'sk-packaging', index: true },
  reelId: { type: mongoose.Schema.Types.ObjectId, ref: 'ReelUnit', required: true },
  reelCode: { type: String, trim: true },
  reelRole: { type: String, enum: ['plain_surface', 'flute'], required: true },
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
  machineName: { type: String, trim: true, maxlength: 100 },
  fluteProfile: { type: String, enum: ['narrow', 'broad'], default: 'narrow' },
  fluteTakeUpFactor: { type: Number, enum: [1.5, 1.6], default: 1.5 },
  expectedFluteWeightKg: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  actualFluteWeightKg: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  fluteWeightVarianceKg: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  wasteBreakdown: [{
    category: {
      type: String,
      enum: ['edge_trim', 'setup_waste', 'quality_rejection', 'moisture_damage', 'handling_damage', 'other'],
      required: true
    },
    weightKg: { type: mongoose.Schema.Types.Decimal128, required: true, min: 0.001 },
    notes: { type: String, trim: true, maxlength: 250 }
  }],
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

consumedReelSchema.plugin(companyScopePlugin);

module.exports = mongoose.model('ProductionRun', productionRunSchema);
