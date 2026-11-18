const mongoose = require('mongoose');

const companyScopePlugin = require('../utils/companyScope');
const corrugatedSheetSchema = new mongoose.Schema({
  companyKey: { type: String, enum: ['sk-packaging', 'nsb-industrial-solutions'], default: 'sk-packaging', index: true },
  productionRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionRun' },
  pastingRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'PastingRun' },
  
  // Specifications
  ply: { type: Number, required: true, enum: [2, 3, 5, 7, 9] },
  lengthInches: { type: Number, required: true },
  widthInches: { type: Number, required: true },
  
  // Quantity and Weight
  sheetCount: { type: Number, required: true },
  totalWeightKg: { type: mongoose.Schema.Types.Decimal128, required: true },
  unitCostPerKg: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  costingStatus: { type: String, enum: ['available', 'unavailable'], default: 'unavailable' },
  
  status: { type: String, enum: ['available', 'consumed'], default: 'available' }
}, { timestamps: true });

corrugatedSheetSchema.plugin(companyScopePlugin);

module.exports = mongoose.model('CorrugatedSheet', corrugatedSheetSchema);