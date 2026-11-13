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
  
  // What went in:
  inputReels: [consumedReelSchema],
  
  // Total raw material weight used
  totalInputWeightKg: { type: mongoose.Schema.Types.Decimal128, required: true },
  
  // Total weight of the sheets produced (used to calculate waste)
  totalOutputWeightKg: { type: mongoose.Schema.Types.Decimal128, required: true },
  
  // Calculated trim/core waste for this run
  wasteGeneratedKg: { type: mongoose.Schema.Types.Decimal128, required: true },
  
  status: { type: String, enum: ['draft', 'completed'], default: 'draft' },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('ProductionRun', productionRunSchema);