const mongoose = require('mongoose');

const scrapSaleSchema = new mongoose.Schema({
  saleDate: { type: Date, default: Date.now },
  buyerName: { type: String, required: true, trim: true },
  weightSoldKg: { type: Number, required: true, min: 1 },
  ratePerKg: { type: Number, required: true, min: 0 },
  totalAmount: { type: Number, required: true },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('ScrapSale', scrapSaleSchema);