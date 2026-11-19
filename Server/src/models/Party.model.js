const mongoose = require('mongoose');

const companyScopePlugin = require('../utils/companyScope');
const ledgerSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  type: { type: String, required: true }, // e.g., 'Tax Invoice', 'Payment Received'
  ref: { type: String },
  debit: { type: Number, default: 0 },
  credit: { type: Number, default: 0 },
  balance: { type: Number, required: true }, // Snapshot of the balance at this moment
  allocations: [{
    billEntryId: { type: mongoose.Schema.Types.ObjectId, required: true },
    amount: { type: Number, required: true, min: 0.01 }
  }]
});

const partySchema = new mongoose.Schema({
  companyKey: { type: String, enum: ['sk-packaging', 'nsb-industrial-solutions'], default: 'sk-packaging', index: true },
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ['Customer', 'Supplier', 'Both'], required: true },
  phone: { type: String },
  email: { type: String, trim: true, lowercase: true },
  gstin: { type: String, trim: true, uppercase: true, match: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/ },
  legalName: { type: String, trim: true },
  tradeName: { type: String, trim: true },
  registeredAddress: { type: String, trim: true },
  pincode: { type: String, trim: true },
  city: { type: String },
  stateName: { type: String, trim: true },
  registrationStatus: { type: String, trim: true },
  stateCode: { type: String, trim: true, uppercase: true, match: /^(0[1-9]|[12][0-9]|3[0-8]|97|99)$/ },
  isActive: { type: Boolean, default: true },
  balance: { type: Number, default: 0 }, // Positive = They owe you. Negative = You owe them.
  ledger: [ledgerSchema]
}, { timestamps: true });

// ledgerSchema.plugin(companyScopePlugin);

module.exports = mongoose.model('Party', partySchema);
module.exports = mongoose.models.Party || mongoose.model('Party', partySchema);