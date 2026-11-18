
const mongoose = require('mongoose');
const companyScopePlugin = require('../utils/companyScope');
const facingMaterialBatchSchema = new mongoose.Schema({
  companyKey: { type: String, enum: ['sk-packaging', 'nsb-industrial-solutions'], default: 'sk-packaging', index: true },
  batchNumber: { type: String, unique: true, required: true },
  materialType: { type: String, enum: ['printed', 'printed_laminated', 'khaki', 'duplex'], required: true },
  lengthInches: { type: Number, required: true, min: 0.1 },
  widthInches: { type: Number, required: true, min: 0.1 },
  sheetCount: { type: Number, required: true, min: 1 },
  receivedWeightKg: { type: mongoose.Schema.Types.Decimal128, required: true },
  remainingWeightKg: { type: mongoose.Schema.Types.Decimal128, required: true },
  remainingSheets: { type: Number, required: true },
  ratePerKg: { type: mongoose.Schema.Types.Decimal128, required: true },
  totalValue: { type: mongoose.Schema.Types.Decimal128, required: true },
  supplierName: { type: String, trim: true, default: '' },
  jobWorkerName: { type: String, trim: true, default: '' },
  jobWorkOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobWorkOrder' },
  inwardDate: { type: Date, required: true },
  notes: { type: String, trim: true, maxlength: 500 },
  status: { type: String, enum: ['available', 'partial', 'consumed'], default: 'available' },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
facingMaterialBatchSchema.index({ inwardDate: -1 });
facingMaterialBatchSchema.plugin(companyScopePlugin);

module.exports = mongoose.model('FacingMaterialBatch', facingMaterialBatchSchema);
