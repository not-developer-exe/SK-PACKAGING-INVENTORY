
const mongoose = require('mongoose');
const companyScopePlugin = require('../utils/companyScope');
const pastingRunSchema = new mongoose.Schema({
  companyKey: { type: String, enum: ['sk-packaging', 'nsb-industrial-solutions'], default: 'sk-packaging', index: true },
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
  sheetMaterialCost: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  rawMaterialCost: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  rawMaterialConsumptions: [{
    materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterial', required: true },
    code: { type: String }, name: { type: String }, uom: { type: String },
    quantity: { type: Number, required: true, min: 0.000001 },
    rate: { type: Number, default: 0, min: 0 }, amount: { type: Number, default: 0, min: 0 }
  }],
  unitCostPerKg: { type: mongoose.Schema.Types.Decimal128, required: true },
  outputSheetId: { type: mongoose.Schema.Types.ObjectId, ref: 'CorrugatedSheet' },
  notes: { type: String, trim: true, maxlength: 500 },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
pastingRunSchema.index({ runDate: -1 });
pastingRunSchema.plugin(companyScopePlugin);

module.exports = mongoose.model('PastingRun', pastingRunSchema);
