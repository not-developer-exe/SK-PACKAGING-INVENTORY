const mongoose = require('mongoose');
const companyScopePlugin = require('../utils/companyScope');

const rawMaterialSchema = new mongoose.Schema({
  companyKey: { type: String, enum: ['sk-packaging', 'nsb-industrial-solutions'], default: 'sk-packaging', index: true },
  code: { type: String, required: true, trim: true, uppercase: true },
  name: { type: String, required: true, trim: true },
  category: { type: String, enum: ['adhesive', 'packing', 'printing', 'consumable', 'other'], default: 'consumable' },
  uom: { type: String, enum: ['kg', 'g', 'litre', 'ml', 'pcs', 'roll', 'box', 'bundle'], required: true },
  openingQty: { type: Number, default: 0, min: 0 },
  currentQty: { type: Number, default: 0, min: 0 },
  reorderLevel: { type: Number, default: 0, min: 0 },
  averageRate: { type: Number, default: 0, min: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

rawMaterialSchema.index({ companyKey: 1, code: 1 }, { unique: true });
rawMaterialSchema.plugin(companyScopePlugin);
module.exports = mongoose.models.RawMaterial || mongoose.model('RawMaterial', rawMaterialSchema);
