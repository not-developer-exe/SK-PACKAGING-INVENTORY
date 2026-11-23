const mongoose = require('mongoose');

const openingStockSnapshotSchema = new mongoose.Schema({
  companyKey: { type: String, enum: ['sk-packaging', 'nsb-industrial-solutions'], required: true, index: true },
  stockDate: { type: Date, required: true, index: true },
  sourceWorkbook: { type: String, required: true },
  sourceSheet: { type: String, required: true },
  category: { type: String, required: true },
  categoryLabel: { type: String, required: true },
  totalWeightKg: { type: Number, default: null },
  totalQuantity: { type: Number, default: null },
  totalAmount: { type: Number, default: null },
  taxAmount: { type: Number, default: null },
  gstRate: { type: Number, default: null },
  sourceRows: { type: [mongoose.Schema.Types.Mixed], default: [] },
  importStatus: { type: String, enum: ['summary_only', 'detailed'], default: 'summary_only' },
  notes: { type: String, default: '' }
}, { timestamps: true });

openingStockSnapshotSchema.index({ companyKey: 1, stockDate: 1, category: 1 }, { unique: true });
module.exports = mongoose.models.OpeningStockSnapshot || mongoose.model('OpeningStockSnapshot', openingStockSnapshotSchema);
