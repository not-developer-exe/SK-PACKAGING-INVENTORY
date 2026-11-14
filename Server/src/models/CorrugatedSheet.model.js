const mongoose = require('mongoose');

const corrugatedSheetSchema = new mongoose.Schema({
  productionRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionRun', required: true },
  
  // Specifications
  ply: { type: Number, required: true, enum: [3, 5, 7, 9] },
  lengthInches: { type: Number, required: true },
  widthInches: { type: Number, required: true },
  
  // Quantity and Weight
  sheetCount: { type: Number, required: true },
  totalWeightKg: { type: mongoose.Schema.Types.Decimal128, required: true },
  unitCostPerKg: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  costingStatus: { type: String, enum: ['available', 'unavailable'], default: 'unavailable' },
  
  status: { type: String, enum: ['available', 'consumed'], default: 'available' }
}, { timestamps: true });

module.exports = mongoose.model('CorrugatedSheet', corrugatedSheetSchema);