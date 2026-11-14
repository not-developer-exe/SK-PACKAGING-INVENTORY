const mongoose = require('mongoose');

const invoicePaymentSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  amount: { type: Number, required: true, min: 0.01 },
  mode: { type: String, required: true, trim: true },
  reference: { type: String, trim: true },
  ledgerEntryId: { type: mongoose.Schema.Types.ObjectId, required: true }
});

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true, unique: true },
  invoiceDate: { type: Date, required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true },
  dispatchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dispatch', required: true }, // Links directly to Delivery Challan
  
  items: [{
    boxId: { type: mongoose.Schema.Types.ObjectId, ref: 'FinishedBox' },
    quantity: { type: Number, required: true },
    rate: { type: Number, required: true },
    taxableAmount: { type: Number, required: true },
    costPerBox: { type: Number, default: null },
    costOfGoods: { type: Number, default: null },
    grossProfit: { type: Number, default: null },
    costingStatus: { type: String, enum: ['available', 'unavailable'], default: 'unavailable' }
  }],

  subTotal: { type: Number, required: true },
  gstPercent: { type: Number, required: true, default: 18 },
  cgstAmount: { type: Number, required: true },
  sgstAmount: { type: Number, required: true },
  grandTotal: { type: Number, required: true },
  balanceDue: { type: Number, required: true },
  costOfGoods: { type: Number, default: null },
  grossProfit: { type: Number, default: null },
  costingStatus: { type: String, enum: ['available', 'unavailable'], default: 'unavailable' },
  payments: { type: [invoicePaymentSchema], default: [] },
  
  status: { type: String, enum: ['Paid', 'Pending', 'Overdue', 'Cancelled'], default: 'Pending' }
}, { timestamps: true });

invoiceSchema.index({ invoiceDate: -1, customerId: 1 });
invoiceSchema.index({ dispatchId: 1 }, { unique: true });

module.exports = mongoose.model('Invoice', invoiceSchema);