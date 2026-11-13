const mongoose = require('mongoose');

const consumedReelSchema = new mongoose.Schema({
  reelId: { type: mongoose.Schema.Types.ObjectId, ref: 'ReelUnit', required: true },
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
  // Only physically measured, recoverable scrap is saleable waste inventory.
  recoverableWasteKg: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  // Input/output variance not accounted for by sheets or measured recoverable scrap.
  processLossKg: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  // Kept for compatibility; new records store recoverable scrap here.
  wasteGeneratedKg: { type: mongoose.Schema.Types.Decimal128, required: true },
  status: { type: String, enum: ['draft', 'completed'], default: 'draft' },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('ProductionRun', productionRunSchema);
