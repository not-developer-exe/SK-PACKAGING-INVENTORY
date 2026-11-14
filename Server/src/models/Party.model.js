const mongoose = require('mongoose');

const ledgerSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  type: { type: String, required: true }, // e.g., 'Tax Invoice', 'Payment Received'
  ref: { type: String },
  debit: { type: Number, default: 0 },
  credit: { type: Number, default: 0 },
  balance: { type: Number, required: true } // Snapshot of the balance at this moment
});

const partySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ['Customer', 'Supplier', 'Both'], required: true },
  phone: { type: String },
  city: { type: String },
  isActive: { type: Boolean, default: true },
  balance: { type: Number, default: 0 }, // Positive = They owe you. Negative = You owe them.
  ledger: [ledgerSchema]
}, { timestamps: true });

// module.exports = mongoose.model('Party', partySchema);
module.exports = mongoose.models.Party || mongoose.model('Party', partySchema);