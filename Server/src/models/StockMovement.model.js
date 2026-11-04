const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema({
  movementType: { type: String, enum: ['inward_receipt', 'sheet_cutting', 'production_issue', 'adjustment'], required: true },
  referenceId: { type: mongoose.Schema.Types.ObjectId, required: true },
  itemType: { type: String, enum: ['reel', 'sheet', 'finished_good'], required: true },
  specificationSummary: { type: String, required: true },
  quantityChange: { type: Number, required: true }, // positive for add, negative for consume
  weightChangeKg: { type: mongoose.Schema.Types.Decimal128, required: true },
  notes: { type: String, trim: true },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

// Immutability protection: block updates/deletes on ledger
stockMovementSchema.pre(['updateOne', 'findOneAndUpdate', 'deleteOne', 'findOneAndDelete'], function() {
  throw new Error('Stock movement ledger is append-only. Modifications are strictly prohibited.');
});

module.exports = mongoose.model('StockMovement', stockMovementSchema);