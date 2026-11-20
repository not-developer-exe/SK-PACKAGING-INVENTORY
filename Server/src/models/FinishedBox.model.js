const mongoose = require('mongoose');

const companyScopePlugin = require('../utils/companyScope');
const finishedBoxSchema = new mongoose.Schema({
  companyKey: { type: String, enum: ['sk-packaging', 'nsb-industrial-solutions'], default: 'sk-packaging', index: true },
  batchNumber: { type: String, required: true, unique: true, trim: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true },
  
  // Box Specifications
  itemName: { type: String, required: true, trim: true },
  ply: { type: Number, required: true },
  dimensions: {
    length: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true }
  },
  
  // Manufacturing details
  sourceSheetId: { type: mongoose.Schema.Types.ObjectId, ref: 'CorrugatedSheet', required: true },
  productSpecificationId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductSpecification', default: null },
  productionPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionPlan', default: null },
  bomSnapshot: { productName: String, ply: Number, sheetsPerBox: Number, expectedKgPerBox: mongoose.Schema.Types.Decimal128, expectedSheets: Number, expectedWeightKg: Number },
  actualConsumption: { sheetsConsumed: Number, weightConsumedKg: Number },
  bomVariance: { sheetVariance: Number, weightVarianceKg: Number, weightVariancePercent: Number },
  quantityProduced: { type: Number, required: true },
  quantityAvailable: { type: Number, required: true },
  materialCost: { type: Number, default: 0, min: 0 },
  costBreakdown: {
    sheetMaterialCost: { type: Number, default: 0, min: 0 },
    rawMaterialCost: { type: Number, default: 0, min: 0 },
    rawMaterialConsumptions: [{
      materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterial' },
      code: String, name: String, uom: String,
      quantity: { type: Number, min: 0 },
      rate: { type: Number, min: 0 },
      amount: { type: Number, min: 0 }
    }],
    labourCost: { type: Number, default: 0, min: 0 },
    otherConversionCost: { type: Number, default: 0, min: 0 },
    totalConversionCost: { type: Number, default: 0, min: 0 },
    totalCost: { type: Number, default: 0, min: 0 }
  },
  costPerBox: { type: Number, default: 0, min: 0 },
  costingStatus: { type: String, enum: ['available', 'unavailable'], default: 'unavailable' },
  
  qualityStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  qualityCheckedAt: { type: Date },
  qualityCheckedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  qualityNotes: { type: String, trim: true, maxlength: 500 },
  status: { type: String, enum: ['available', 'dispatched'], default: 'available' },
  manufacturedAt: { type: Date, default: Date.now },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

finishedBoxSchema.index({ manufacturedAt: -1, customerId: 1 });

finishedBoxSchema.plugin(companyScopePlugin);

module.exports = mongoose.model('FinishedBox', finishedBoxSchema);