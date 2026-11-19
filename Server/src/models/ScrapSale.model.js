const mongoose = require('mongoose');

const companyScopePlugin = require('../utils/companyScope');
const scrapSaleSchema = new mongoose.Schema({
  companyKey: { type: String, enum: ['sk-packaging', 'nsb-industrial-solutions'], default: 'sk-packaging', index: true },
  saleDate: { type: Date, default: Date.now },
  // Existing records without this field are treated as ordinary scrap.
  saleType: { type: String, enum: ['scrap', 'thak'], default: 'scrap', index: true },
  buyerName: { type: String, required: true, trim: true },
  // Scrap may be weighed fractionally; keep this aligned with controller validation.
  weightSoldKg: { type: Number, required: true, min: 0.001 },
  ratePerKg: { type: Number, required: true, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

scrapSaleSchema.index({ saleDate: -1, buyerName: 1 });

scrapSaleSchema.plugin(companyScopePlugin);

module.exports = mongoose.model('ScrapSale', scrapSaleSchema);
