const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  expenseDate: { type: Date, required: true, default: Date.now },
  category: {
    type: String,
    enum: ['electricity', 'labour', 'rent', 'freight', 'repairs', 'admin', 'bank_charges', 'interest', 'miscellaneous'],
    required: true
  },
  amount: { type: Number, required: true, min: 0.01 },
  vendor: { type: String, trim: true, maxlength: 160, default: '' },
  paymentMode: { type: String, enum: ['cash', 'upi', 'bank_transfer', 'cheque', 'card', 'other'], required: true },
  reference: { type: String, trim: true, maxlength: 120, default: '' },
  description: { type: String, trim: true, maxlength: 1000, default: '' },
  costTreatment: { type: String, enum: ['operating_expense', 'finance_cost', 'stock_landed_cost'], default: 'operating_expense' },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

expenseSchema.index({ expenseDate: -1, category: 1 });
module.exports = mongoose.models.Expense || mongoose.model('Expense', expenseSchema);
