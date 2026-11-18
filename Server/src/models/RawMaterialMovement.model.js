const mongoose = require('mongoose');
const companyScopePlugin = require('../utils/companyScope');

const rawMaterialMovementSchema = new mongoose.Schema({
  companyKey: { type: String, enum: ['sk-packaging', 'nsb-industrial-solutions'], default: 'sk-packaging', index: true },
  materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterial', required: true, index: true },
  movementDate: { type: Date, default: Date.now, required: true },
  movementType: { type: String, enum: ['opening', 'inward', 'issue', 'adjustment_in', 'adjustment_out'], required: true },
  quantity: { type: Number, required: true, min: 0.000001 },
  rate: { type: Number, default: 0, min: 0 },
  amount: { type: Number, default: 0, min: 0 },
  reference: { type: String, trim: true, maxlength: 120, default: '' },
  notes: { type: String, trim: true, maxlength: 1000, default: '' },
  balanceAfter: { type: Number, required: true, min: 0 },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

rawMaterialMovementSchema.index({ materialId: 1, movementDate: -1, createdAt: -1 });
rawMaterialMovementSchema.plugin(companyScopePlugin);
module.exports = mongoose.models.RawMaterialMovement || mongoose.model('RawMaterialMovement', rawMaterialMovementSchema);
