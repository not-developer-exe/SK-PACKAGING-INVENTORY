const mongoose = require('mongoose');
const Invoice = require('../models/Invoice'); // Ensure your model names match
const Dispatch = require('../models/Dispatch');
const Party = require('../models/party.model');

// Fetch Dispatches that haven't been billed yet
exports.getUninvoicedDispatches = async (req, res) => {
  try {
    const { customerId } = req.params;
    const dispatches = await Dispatch.find({
      customer: customerId,
      status: { $ne: 'Invoiced' } // Adjust to match your exact Dispatch schema field
    }).populate('boxes.boxId');
    
    res.json(dispatches);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch challans', error: error.message });
  }
};

// Create Invoice using Mongoose Transactions
exports.createInvoice = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { invoiceDate, customerId, dispatchId, items, gstPercent, subTotal, cgstAmount, sgstAmount, grandTotal } = req.body;

    // 1. Generate Invoice Number (e.g., INV-26-XXXX)
    const count = await Invoice.countDocuments();
    const invoiceNumber = `INV-${new Date().getFullYear().toString().slice(-2)}-${String(count + 1).padStart(4, '0')}`;

    // 2. Create the Invoice Document
    const newInvoice = new Invoice({
      invoiceNumber,
      date: invoiceDate,
      customer: customerId,
      dispatchRef: dispatchId,
      items,
      gstPercent,
      subTotal,
      cgstAmount,
      sgstAmount,
      grandTotal
    });
    
    await newInvoice.save({ session });

    // 3. Update the Dispatch to mark it as billed
    await Dispatch.findByIdAndUpdate(
      dispatchId,
      { status: 'Invoiced', invoiceRef: newInvoice._id },
      { session }
    );

    // 4. Update the Customer's Khata (Ledger)
    const party = await Party.findById(customerId).session(session);
    if (!party) throw new Error('Customer not found in Party Master');

    const newBalance = party.balance + grandTotal; // Adding to what they owe us
    
    party.ledger.push({
      date: invoiceDate,
      type: 'Tax Invoice',
      ref: invoiceNumber,
      debit: grandTotal, // Debit customer account (they owe us)
      credit: 0,
      balance: newBalance
    });
    party.balance = newBalance;
    await party.save({ session });

    // COMMIT ALL CHANGES
    await session.commitTransaction();
    res.status(201).json(newInvoice);

  } catch (error) {
    // IF ANYTHING FAILS, REVERT ALL DB CHANGES
    await session.abortTransaction();
    console.error('Transaction Aborted:', error);
    res.status(400).json({ message: 'Transaction Failed, DB state reverted', error: error.message });
  } finally {
    session.endSession();
  }
};