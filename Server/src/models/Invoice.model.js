const mongoose = require('mongoose');

const companyScopePlugin = require('../utils/companyScope');
const invoicePaymentSchema = new mongoose.Schema({
  companyKey: { type: String, enum: ['sk-packaging', 'nsb-industrial-solutions'], default: 'sk-packaging', index: true },
  date: { type: Date, default: Date.now },
  amount: { type: Number, required: true, min: 0.01 },
  mode: { type: String, required: true, trim: true },
  reference: { type: String, trim: true },
  ledgerEntryId: { type: mongoose.Schema.Types.ObjectId, required: true }
});

const invoiceSchema = new mongoose.Schema({
  companyKey: { type: String, enum: ['sk-packaging', 'nsb-industrial-solutions'], default: 'sk-packaging', required: true, index: true },
  workspaceKey: { type: String, enum: ['regular', 'sk-b-sales'], default: 'regular', required: true, index: true },
  invoiceNumber: { type: String, default: undefined, trim: true },
  invoiceDate: { type: Date, required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true },
  dispatchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dispatch', required: true }, // Links directly to Delivery Challan
  sellerSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
  
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
  igstAmount: { type: Number, default: 0 },
  taxType: { type: String, enum: ['CGST_SGST', 'IGST'], default: 'CGST_SGST' },
  placeOfSupplyStateCode: { type: String, trim: true },
  grandTotal: { type: Number, required: true },
  balanceDue: { type: Number, required: true },
  costOfGoods: { type: Number, default: null },
  grossProfit: { type: Number, default: null },
  costingStatus: { type: String, enum: ['available', 'unavailable'], default: 'unavailable' },
  payments: { type: [invoicePaymentSchema], default: [] },
  
  status: { type: String, enum: ['Draft', 'Paid', 'Pending', 'Overdue', 'Cancelled'], default: 'Pending' }
}, { timestamps: true });

invoiceSchema.index({ invoiceDate: -1, customerId: 1, companyKey: 1, workspaceKey: 1 });
invoiceSchema.index({ invoiceNumber: 1 }, { unique: true, sparse: true });
invoiceSchema.index({ dispatchId: 1 }, { unique: true, sparse: true });

invoicePaymentSchema.plugin(companyScopePlugin);
invoiceSchema.plugin(companyScopePlugin);

module.exports = mongoose.model('Invoice', invoiceSchema);