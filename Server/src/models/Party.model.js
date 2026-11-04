const mongoose = require('mongoose');

const partySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  partyType: { 
    type: String, 
    enum: ['supplier', 'customer', 'both'], 
    required: true,
    default: 'supplier' 
  },
  gstin: { type: String, uppercase: true, trim: true },
  phone: { type: String, trim: true },
  address: { type: String, trim: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Index for fast search
partySchema.index({ name: 'text', partyType: 1 });

module.exports = mongoose.model('Party', partySchema);