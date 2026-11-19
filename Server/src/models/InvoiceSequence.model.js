const mongoose = require('mongoose');

const invoiceSequenceSchema = new mongoose.Schema({
  companyKey: { type: String, enum: ['sk-packaging', 'nsb-industrial-solutions'], required: true },
  financialYear: { type: String, required: true },
  nextNumber: { type: Number, required: true, min: 0, default: 0 }
}, { timestamps: true });

invoiceSequenceSchema.index({ companyKey: 1, financialYear: 1 }, { unique: true });

module.exports = mongoose.models.InvoiceSequence || mongoose.model('InvoiceSequence', invoiceSequenceSchema);
