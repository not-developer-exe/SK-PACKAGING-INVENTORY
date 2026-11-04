const mongoose = require('mongoose');

const reelUnitSchema = new mongoose.Schema({
  reelCode: { type: String, required: true, unique: true, trim: true },
  reelWidthInches: { type: Number, required: true },
  bf: { type: Number, required: true },
  gsm: { type: Number, required: true },
  quality: { type: String, enum: ['Natural', 'GY'], required: true },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true },
  inwardReceiptId: { type: mongoose.Schema.Types.ObjectId, ref: 'InwardReceipt', required: true },
  batchReference: { type: String, trim: true },
  originalWeightKg: { type: mongoose.Schema.Types.Decimal128, required: true },
  remainingWeightKg: { type: mongoose.Schema.Types.Decimal128, required: true },
  ratePerKg: { type: mongoose.Schema.Types.Decimal128, required: true },
  status: { type: String, enum: ['available', 'partial', 'consumed'], default: 'available' }
}, { timestamps: true });

module.exports = mongoose.model('ReelUnit', reelUnitSchema);