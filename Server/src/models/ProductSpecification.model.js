const mongoose = require('mongoose');

const companyScopePlugin = require('../utils/companyScope');
const productSpecificationSchema = new mongoose.Schema({
  companyKey: { type: String, enum: ['sk-packaging', 'nsb-industrial-solutions'], default: 'sk-packaging', index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true, index: true },
  productName: { type: String, required: true, trim: true, maxlength: 120 },
  ply: { type: Number, required: true, enum: [3, 5, 7, 9] },
  dimensions: {
    length: { type: Number, required: true, min: 0.01 },
    width: { type: Number, required: true, min: 0.01 },
    height: { type: Number, required: true, min: 0.01 }
  },
  sheetSpecification: {
    lengthInches: { type: Number, required: true, min: 0.01 },
    widthInches: { type: Number, required: true, min: 0.01 }
  },
  sheetsPerBox: { type: Number, required: true, min: 0.0001 },
  expectedKgPerBox: { type: mongoose.Schema.Types.Decimal128, required: true, min: 0.0001 },
  notes: { type: String, trim: true, maxlength: 500, default: '' },
  isActive: { type: Boolean, default: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

productSpecificationSchema.index(
  { customerId: 1, productName: 1, isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true }, collation: { locale: 'en', strength: 2 } }
);

productSpecificationSchema.plugin(companyScopePlugin);

module.exports = mongoose.models.ProductSpecification || mongoose.model('ProductSpecification', productSpecificationSchema);
