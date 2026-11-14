const mongoose = require('mongoose');

const finishedBoxSchema = new mongoose.Schema({
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
  quantityProduced: { type: Number, required: true },
  quantityAvailable: { type: Number, required: true },
  materialCost: { type: Number, default: 0, min: 0 },
  costPerBox: { type: Number, default: 0, min: 0 },
  costingStatus: { type: String, enum: ['available', 'unavailable'], default: 'unavailable' },
  
  status: { type: String, enum: ['available', 'dispatched'], default: 'available' },
  manufacturedAt: { type: Date, default: Date.now },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

finishedBoxSchema.index({ manufacturedAt: -1, customerId: 1 });

module.exports = mongoose.model('FinishedBox', finishedBoxSchema);