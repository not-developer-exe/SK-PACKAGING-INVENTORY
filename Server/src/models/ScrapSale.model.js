const mongoose = require('mongoose');

const scrapSaleSchema = new mongoose.Schema({
  saleDate: { type: Date, default: Date.now },
  buyerName: { type: String, required: true, trim: true },
  // Scrap may be weighed fractionally; keep this aligned with controller validation.
  weightSoldKg: { type: Number, required: true, min: 0.001 },
  ratePerKg: { type: Number, required: true, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

scrapSaleSchema.index({ saleDate: -1, buyerName: 1 });

module.exports = mongoose.model('ScrapSale', scrapSaleSchema);
