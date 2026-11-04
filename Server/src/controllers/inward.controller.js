const mongoose = require('mongoose');
const InwardReceipt = require('../models/InwardReceipt.model');
const ReelUnit = require('../models/ReelUnit.model');
const StockMovement = require('../models/StockMovement.model');
const Party = require('../models/Party.model');

// 1. Create Draft Receipt
exports.createDraftReceipt = async (req, res) => {
  try {
    const { supplierId, invoiceReference, receiptDate, notes, lines } = req.body;

    if (!supplierId || !invoiceReference || !lines || lines.length === 0) {
      return res.status(400).json({ message: 'Supplier, invoice reference, and at least one line item are required.' });
    }

    const supplier = await Party.findById(supplierId);
    if (!supplier || !['supplier', 'both'].includes(supplier.partyType)) {
      return res.status(400).json({ message: 'Invalid or non-supplier party selected.' });
    }

    // Generate unique receipt number
    const count = await InwardReceipt.countDocuments();
    const receiptNumber = `IR-${String(count + 1).padStart(5, '0')}`;

    const receipt = await InwardReceipt.create({
      receiptNumber,
      receiptDate: receiptDate || Date.now(),
      supplierId,
      invoiceReference,
      notes,
      lines,
      status: 'draft'
    });

    res.status(201).json({ message: 'Inward receipt draft saved successfully', receipt });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'An inward receipt with this supplier and invoice reference already exists.' });
    }
    res.status(500).json({ message: 'Error creating inward receipt draft', error: error.message });
  }
};

// Get all receipts
exports.getReceipts = async (req, res) => {
  try {
    const receipts = await InwardReceipt.find().populate('supplierId', 'name gstin').sort({ createdAt: -1 });
    res.json({ receipts });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching receipts', error: error.message });
  }
};

// 2. Post Draft Receipt (Atomic Transaction)
exports.postReceipt = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const receiptId = req.params.id;

    // Atomically find and lock the draft receipt
    const receipt = await InwardReceipt.findOneAndUpdate(
      { _id: receiptId, status: 'draft' },
      { $set: { status: 'posted', postedAt: new Date(), postedBy: req.user._id } },
      { new: true, session }
    );

    if (!receipt) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Receipt not found or already posted.' });
    }

    let reelCounter = await ReelUnit.countDocuments();

    // Process each line item
    for (const line of receipt.lines) {
      const weightNum = parseFloat(line.totalWeightKg.toString());
      const qty = line.reelCount;
      const weightPerReel = weightNum / qty;

      for (let i = 0; i < qty; i++) {
        reelCounter++;
        const reelCode = `RL-${String(reelCounter).padStart(6, '0')}`;

        // Create individual physical reel unit
        await ReelUnit.create([{
          reelCode,
          reelWidthInches: line.reelWidthInches,
          bf: line.bf,
          gsm: line.gsm,
          quality: line.quality,
          supplierId: receipt.supplierId,
          inwardReceiptId: receipt._id,
          batchReference: line.supplierBatchRef || receipt.invoiceReference,
          originalWeightKg: weightPerReel,
          remainingWeightKg: weightPerReel,
          ratePerKg: line.ratePerKg,
          status: 'available'
        }], { session });
      }

      // Append to immutable Stock Movement Ledger
      await StockMovement.create([{
        movementType: 'inward_receipt',
        referenceId: receipt._id,
        itemType: 'reel',
        specificationSummary: `${line.reelWidthInches}" | BF ${line.bf} | ${line.gsm} GSM | ${line.quality}`,
        quantityChange: qty,
        weightChangeKg: weightNum,
        notes: `Inward Receipt ${receipt.receiptNumber} - Inv: ${receipt.invoiceReference}`,
        performedBy: req.user._id
      }], { session });
    }

    await session.commitTransaction();
    session.endSession();

    res.json({ message: 'Receipt posted successfully. Reel stock and ledger updated.', receipt });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: 'Error posting receipt', error: error.message });
  }
};