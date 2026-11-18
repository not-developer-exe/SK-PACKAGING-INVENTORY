const mongoose = require('mongoose');

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
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ['Customer', 'Supplier', 'Both'], required: true },
  phone: { type: String },
  city: { type: String },
  stateCode: { type: String, trim: true, uppercase: true, match: /^(0[1-9]|[12][0-9]|3[0-8]|97|99)$/ },
  isActive: { type: Boolean, default: true },
  balance: { type: Number, default: 0 }, // Positive = They owe you. Negative = You owe them.
  ledger: [ledgerSchema]
}, { timestamps: true });

// module.exports = mongoose.model('Party', partySchema);
module.exports = mongoose.models.Party || mongoose.model('Party', partySchema);