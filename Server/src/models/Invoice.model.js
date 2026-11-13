const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true, unique: true },
  invoiceDate: { type: Date, required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true },
  dispatchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dispatch', required: true }, // Links directly to Delivery Challan
  
  items: [{
    boxId: { type: mongoose.Schema.Types.ObjectId, ref: 'Box' },
    quantity: { type: Number, required: true },
    rate: { type: Number, required: true },
    taxableAmount: { type: Number, required: true }
  }],

  subTotal: { type: Number, required: true },
  gstPercent: { type: Number, required: true, default: 18 },
  cgstAmount: { type: Number, required: true },
  sgstAmount: { type: Number, required: true },
  grandTotal: { type: Number, required: true },
  balanceDue: { type: Number, required: true },
  
  status: { type: String, enum: ['Paid', 'Pending', 'Overdue', 'Cancelled'], default: 'Pending' }
}, { timestamps: true });

module.exports = mongoose.model('Invoice', invoiceSchema);