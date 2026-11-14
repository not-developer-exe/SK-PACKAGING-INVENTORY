const mongoose = require('mongoose');

const reconciliationLineSchema = new mongoose.Schema({
  reelId: { type: mongoose.Schema.Types.ObjectId, ref: 'ReelUnit', required: true },
  reelCode: { type: String, required: true },
  specificationSummary: { type: String, required: true },
  systemWeightKg: { type: mongoose.Schema.Types.Decimal128, required: true },
  countedWeightKg: { type: mongoose.Schema.Types.Decimal128, required: true },
  varianceKg: { type: mongoose.Schema.Types.Decimal128, required: true }
});

const stockReconciliationSchema = new mongoose.Schema({
  reconciliationNumber: { type: String, required: true, unique: true, trim: true },
  countedAt: { type: Date, required: true, default: Date.now },
  reason: { type: String, required: true, trim: true },
  status: { type: String, enum: ['posted'], default: 'posted' },
  lines: { type: [reconciliationLineSchema], required: true },
  totalVarianceKg: { type: mongoose.Schema.Types.Decimal128, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('StockReconciliation', stockReconciliationSchema);
