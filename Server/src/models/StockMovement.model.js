const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema({
  movementType: { 
    type: String, 
    required: true,
    // Added 'adjustment' and 'dispatch' to the VIP list
    enum: ['inward_receipt', 'production_issue', 'sheet_cutting', 'adjustment', 'dispatch'] 
  },
  referenceId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true,
    refPath: 'referenceModel'
  },
  referenceModel: {
    type: String,
    enum: ['InwardReceipt', 'ProductionRun', 'CorrugatedSheet', 'FinishedBox', 'Dispatch', 'ReelUnit']
  },
  itemType: {
    type: String,
    required: true,
    enum: ['reel', 'sheet', 'finished_good']
  },
  specificationSummary: { type: String, required: true },
  quantityChange: { type: Number, required: true },
  weightChangeKg: { type: mongoose.Schema.Types.Decimal128, required: true },
  notes: { type: String },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('StockMovement', stockMovementSchema);