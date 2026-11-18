const mongoose = require('mongoose');

const companyScopePlugin = require('../utils/companyScope');
const stockMovementSchema = new mongoose.Schema({
  companyKey: { type: String, enum: ['sk-packaging', 'nsb-industrial-solutions'], default: 'sk-packaging', index: true },
  movementDate: { type: Date, default: Date.now },
  movementType: {
    type: String,
    required: true,
    enum: ['inward_receipt', 'production_issue', 'sheet_cutting', 'sheet_pasting', 'adjustment', 'dispatch', 'job_work_issue', 'job_work_return']
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'referenceModel'
  },
  referenceModel: {
    type: String,
    enum: ['InwardReceipt', 'ProductionRun', 'PastingRun', 'CorrugatedSheet', 'FacingMaterialBatch', 'FinishedBox', 'Dispatch', 'ReelUnit', 'OpeningStockAdjustment', 'StockReconciliation', 'JobWorkOrder', 'CutSheetBatch']
  },
  itemType: {
    type: String,
    required: true,
    enum: ['reel', 'sheet', 'facing_material', 'finished_good']
  },
  specificationSummary: { type: String, required: true },
  quantityChange: { type: Number, required: true },
  weightChangeKg: { type: mongoose.Schema.Types.Decimal128, required: true },
  notes: { type: String },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

stockMovementSchema.index({ movementDate: -1, createdAt: -1 });

stockMovementSchema.plugin(companyScopePlugin);

module.exports = mongoose.model('StockMovement', stockMovementSchema);
