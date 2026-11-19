const mongoose = require('mongoose');
const companyScopePlugin = require('../utils/companyScope');

const jobWorkOrderSchema = new mongoose.Schema({
  companyKey: { type: String, enum: ['sk-packaging', 'nsb-industrial-solutions'], default: 'sk-packaging', index: true },
  orderNumber: { type: String, required: true, unique: true },
  jobWorkerName: { type: String, required: true, trim: true, maxlength: 160 },
  processType: { type: String, enum: ['offset_printing', 'lamination', 'other'], required: true },
  inputBatchModel: { type: String, enum: ['FacingMaterialBatch', 'CutSheetBatch'], default: 'FacingMaterialBatch', required: true },
  inputBatchId: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'inputBatchModel' },
  inputItemType: { type: String, enum: ['facing_material', 'cut_sheet'], default: 'facing_material', required: true },
  inputMaterialCost: { type: Number, default: 0, min: 0 },
  materialType: { type: String, enum: ['printed', 'printed_laminated', 'khaki', 'duplex'], required: true },
  lengthInches: { type: Number, required: true },
  widthInches: { type: Number, required: true },
  issuedSheets: { type: Number, required: true },
  issuedWeightKg: { type: Number, required: true },
  returnedSheets: { type: Number, default: 0 },
  returnedWeightKg: { type: Number, default: 0 },
  wastageSheets: { type: Number, default: 0 },
  wastageWeightKg: { type: Number, default: 0 },
  jobCharges: { type: Number, default: 0 },
  allocatedInputMaterialCost: { type: Number, default: 0 },
  allocatedWastageMaterialCost: { type: Number, default: 0 },
  issueDate: { type: Date, required: true },
  expectedReturnDate: { type: Date },
  status: { type: String, enum: ['issued', 'partial_return', 'completed', 'cancelled'], default: 'issued' },
  returns: [{
    returnDate: { type: Date, required: true },
    sheets: { type: Number, required: true },
    weightKg: { type: Number, required: true },
    wastageSheets: { type: Number, default: 0 },
    wastageWeightKg: { type: Number, default: 0 },
    charges: { type: Number, default: 0 },
    allocatedMaterialCost: { type: Number, default: 0 },
    allocatedJobCharges: { type: Number, default: 0 },
    allocatedWastageMaterialCost: { type: Number, default: 0 },
    outputBatchId: { type: mongoose.Schema.Types.ObjectId, ref: 'FacingMaterialBatch' },
    notes: { type: String, default: '' }
  }],
  notes: { type: String, trim: true, maxlength: 1000, default: '' },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
jobWorkOrderSchema.index({ issueDate: -1, status: 1 });
jobWorkOrderSchema.plugin(companyScopePlugin);
module.exports = mongoose.models.JobWorkOrder || mongoose.model('JobWorkOrder', jobWorkOrderSchema);
