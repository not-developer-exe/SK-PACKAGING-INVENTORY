const Invoice = require('../models/Invoice.model');
const Dispatch = require('../models/Dispatch.model');

// Create a new Invoice based on a Dispatch Challan
exports.createInvoice = async (req, res) => {
  try {
    const { invoiceDate, customerId, dispatchId, items, gstPercent } = req.body;

    // Calculate Financials
    let subTotal = 0;
    const formattedItems = items.map(item => {
      const taxableAmount = item.quantity * item.rate;
      subTotal += taxableAmount;
      return { ...item, taxableAmount };
    });

    const cgstAmount = (subTotal * (gstPercent / 2)) / 100;
    const sgstAmount = (subTotal * (gstPercent / 2)) / 100;
    const grandTotal = Math.round(subTotal + cgstAmount + sgstAmount); // Round to nearest rupee

    // Generate Auto Invoice Number
    const count = await Invoice.countDocuments();
    const invoiceNumber = `INV-SK-${new Date().getFullYear().toString().slice(-2)}-${(count + 1).toString().padStart(3, '0')}`;

    const newInvoice = new Invoice({
      invoiceNumber,
      invoiceDate,
      customerId,
      dispatchId,
      items: formattedItems,
      subTotal,
      gstPercent,
      cgstAmount,
      sgstAmount,
      grandTotal,
      balanceDue: grandTotal,
      status: 'Pending'
    });

    await newInvoice.save();
    res.status(201).json({ message: 'Invoice created successfully', invoice: newInvoice });
  } catch (error) {
    res.status(500).json({ message: 'Error creating invoice', error: error.message });
  }
};

// Fetch all invoices for the Ledger
exports.getInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find()
      .populate('customerId', 'name')
      .sort({ createdAt: -1 });
    res.status(200).json(invoices);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching invoices', error: error.message });
  }
};

// MAGIC FUNCTION: Fetch only Dispatches that have NOT been invoiced yet
exports.getUninvoicedDispatches = async (req, res) => {
  try {
    const { customerId } = req.params;
    
    // Find all dispatch IDs that already have an invoice
    const invoicedDispatchIds = await Invoice.find({ customerId, status: { $ne: 'Cancelled' } }).distinct('dispatchId');
    
    // Find dispatches for this customer that are NOT in the invoiced list
    const uninvoiced = await Dispatch.find({ 
      customerId, 
      _id: { $nin: invoicedDispatchIds } 
    }).populate('boxes.boxId');
    
    res.status(200).json(uninvoiced);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching uninvoiced dispatches', error: error.message });
  }
};