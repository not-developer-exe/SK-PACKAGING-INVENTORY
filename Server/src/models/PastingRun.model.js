
const mongoose = require('mongoose');
const pastingRunSchema = new mongoose.Schema({
  runNumber: { type: String, required: true, unique: true },
  runDate: { type: Date, required: true },
  operatorName: { type: String, trim: true, required: true },
  machineName: { type: String, trim: true, default: '' },
  sourceSheetId: { type: mongoose.Schema.Types.ObjectId, ref: 'CorrugatedSheet', required: true },
  facingBatchId: { type: mongoose.Schema.Types.ObjectId, ref: 'FacingMaterialBatch', required: true },
  sheetsConsumed: { type: Number, required: true },
  facingSheetsConsumed: { type: Number, required: true },
  outputSheetCount: { type: Number, required: true },
  outputWeightKg: { type: mongoose.Schema.Types.Decimal128, required: true },
  facingWeightKg: { type: mongoose.Schema.Types.Decimal128, required: true },
  adhesiveWeightKg: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  wasteWeightKg: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  materialCost: { type: mongoose.Schema.Types.Decimal128, required: true },
  unitCostPerKg: { type: mongoose.Schema.Types.Decimal128, required: true },
  outputSheetId: { type: mongoose.Schema.Types.ObjectId, ref: 'CorrugatedSheet' },
  notes: { type: String, trim: true, maxlength: 500 },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
pastingRunSchema.index({ runDate: -1 });
module.exports = mongoose.model('PastingRun', pastingRunSchema);
