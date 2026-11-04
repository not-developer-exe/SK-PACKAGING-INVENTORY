const mongoose = require('mongoose');

const inwardReceiptLineSchema = new mongoose.Schema({
  reelWidthInches: { type: Number, required: true },
  bf: { type: Number, required: true },
  gsm: { type: Number, required: true },
  quality: { type: String, enum: ['Natural', 'GY'], required: true, default: 'Natural' },
  reelCount: { type: Number, required: true, min: 1 },
  totalWeightKg: { type: mongoose.Schema.Types.Decimal128, required: true },
  isAggregateWeightOnly: { type: Boolean, default: false },
  supplierBatchRef: { type: String, trim: true },
  ratePerKg: { type: mongoose.Schema.Types.Decimal128, required: true },
  freightCharges: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  otherCharges: { type: mongoose.Schema.Types.Decimal128, default: 0 }
});

const inwardReceiptSchema = new mongoose.Schema({
  receiptNumber: { type: String, required: true, unique: true, trim: true },
  receiptDate: { type: Date, required: true, default: Date.now },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true },
  invoiceReference: { type: String, required: true, trim: true },
  status: { type: String, enum: ['draft', 'posted', 'cancelled'], default: 'draft' },
  notes: { type: String, trim: true },
  lines: [inwardReceiptLineSchema],
  postedAt: { type: Date },
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  idempotencyKey: { type: String, unique: true, sparse: true }
}, { timestamps: true });

// Prevent duplicate invoice numbers from the same supplier
inwardReceiptSchema.index({ supplierId: 1, invoiceReference: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('InwardReceipt', inwardReceiptSchema);