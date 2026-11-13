const mongoose = require('mongoose');
const InwardReceipt = require('../models/InwardReceipt.model');
const ReelUnit = require('../models/ReelUnit.model');
const StockMovement = require('../models/StockMovement.model');
const Party = require('../models/Party.model');
const Sequence = require('../models/Sequence.model');

// 1. Create Draft Receipt
exports.createDraftReceipt = async (req, res) => {
  try {
    const { supplierId, invoiceReference, receiptDate, notes, lines } = req.body || {};

    if (!mongoose.isValidObjectId(supplierId) || typeof invoiceReference !== 'string' || !invoiceReference.trim() || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ message: 'A valid supplier, invoice reference and at least one line item are required.' });
    }

    const invalidLine = lines.some((line) => {
      const width = Number(line.reelWidthInches);
      const bf = Number(line.bf);
      const gsm = Number(line.gsm);
      const count = Number(line.reelCount);
      const weight = Number(line.totalWeightKg);
      const rate = Number(line.ratePerKg);
      return !Number.isFinite(width) || width <= 0 ||
        !Number.isFinite(bf) || bf <= 0 ||
        !Number.isFinite(gsm) || gsm <= 0 ||
        !Number.isInteger(count) || count <= 0 ||
        !Number.isFinite(weight) || weight <= 0 ||
        !Number.isFinite(rate) || rate < 0;
    });
    if (invalidLine) {
      return res.status(400).json({ message: 'Each inward line needs positive reel dimensions, a whole reel count, positive total weight and a non-negative rate.' });
    }

    const supplier = await Party.findById(supplierId);
    if (!supplier || !['Supplier', 'Both'].includes(supplier.type)) {
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
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid inward receipt ID.' });
  }

  const session = await mongoose.startSession();
  try {
    let postedReceipt;
    await session.withTransaction(async () => {
      const receipt = await InwardReceipt.findOneAndUpdate(
        { _id: req.params.id, status: 'draft' },
        { $set: { status: 'posted', postedAt: new Date(), postedBy: req.user._id } },
        { new: true, session }
      );

      if (!receipt) {
        const error = new Error('Receipt not found or already posted.');
        error.statusCode = 409;
        throw error;
      }

      // Validate stored draft data again before stock is created.
      for (const line of receipt.lines) {
        const qty = Number(line.reelCount);
        const weightNum = Number(line.totalWeightKg.toString());
        const width = Number(line.reelWidthInches);
        const rate = Number(line.ratePerKg.toString());
        if (!Number.isInteger(qty) || qty <= 0 || !Number.isFinite(weightNum) || weightNum <= 0 ||
            !Number.isFinite(width) || width <= 0 || !Number.isFinite(rate) || rate < 0) {
          const error = new Error('Receipt contains an invalid line. Correct the draft before posting.');
          error.statusCode = 400;
          throw error;
        }
      }

      const existingReelCount = await ReelUnit.countDocuments().session(session);
      const totalReelsToCreate = receipt.lines.reduce((sum, line) => sum + Number(line.reelCount), 0);
      const reelSequence = await Sequence.findOneAndUpdate(
        { _id: 'reel-unit' },
        { $max: { value: existingReelCount }, $inc: { value: totalReelsToCreate } },
        { new: true, upsert: true, setDefaultsOnInsert: true, session }
      );
      let reelCounter = reelSequence.value - totalReelsToCreate;

      for (const line of receipt.lines) {
        const weightNum = Number(line.totalWeightKg.toString());
        const qty = Number(line.reelCount);
        const weightPerReel = weightNum / qty;

        for (let i = 0; i < qty; i++) {
          reelCounter += 1;
          const reelCode = `RL-${String(reelCounter).padStart(6, '0')}`;
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

        await StockMovement.create([{
          movementType: 'inward_receipt',
          referenceId: receipt._id,
          referenceModel: 'InwardReceipt',
          itemType: 'reel',
          specificationSummary: `${line.reelWidthInches}" | BF ${line.bf} | ${line.gsm} GSM | ${line.quality}`,
          quantityChange: qty,
          weightChangeKg: weightNum,
          notes: `Inward Receipt ${receipt.receiptNumber} - Inv: ${receipt.invoiceReference}`,
          performedBy: req.user._id
        }], { session });
      }

      postedReceipt = receipt;
    });

    return res.json({ message: 'Receipt posted successfully. Reel stock and ledger updated.', receipt: postedReceipt });
  } catch (error) {
    console.error('[INWARD] Posting failed:', error.message);
    return res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : 'Error posting receipt'
    });
  } finally {
    await session.endSession();
  }
};
