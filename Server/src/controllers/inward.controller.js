const mongoose = require('mongoose');
const InwardReceipt = require('../models/InwardReceipt.model');
const ReelUnit = require('../models/ReelUnit.model');
const StockMovement = require('../models/StockMovement.model');
const Party = require('../models/Party.model');
const Sequence = require('../models/Sequence.model');
const writeAuditLog = require('../utils/writeAuditLog');
const { calculateLandedRatePerKg } = require('../utils/materialCosting');
const { normalizeInwardReelWeights } = require('../utils/inwardReelWeights');
const { buildDateRangeFilter, isValidDateOnly } = require('../utils/dateFilters');

const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === '') return NaN;
  return Number(value);
};

// 1. Create Draft Receipt
exports.createDraftReceipt = async (req, res) => {
  try {
    const { supplierId, invoiceReference, receiptDate, notes, lines } = req.body || {};

    if (!mongoose.isValidObjectId(supplierId) ||
        typeof invoiceReference !== 'string' ||
        !invoiceReference.trim() ||
        !Array.isArray(lines) ||
        lines.length === 0) {
      return res.status(400).json({ message: 'A valid supplier, invoice reference and at least one line item are required.' });
    }

    const parsedReceiptDate = receiptDate === undefined || receiptDate === null || receiptDate === ''
      ? new Date()
      : (isValidDateOnly(receiptDate) ? new Date(receiptDate + 'T00:00:00+05:30') : new Date(NaN));
    if (Number.isNaN(parsedReceiptDate.getTime())) {
      return res.status(400).json({ message: 'Receipt date must be a valid date.' });
    }

    const invalidLine = lines.some((line) => {
      if (!line || typeof line !== 'object' || Array.isArray(line)) return true;

      const width = toFiniteNumber(line.reelWidthInches);
      const bf = toFiniteNumber(line.bf);
      const gsm = toFiniteNumber(line.gsm);
      const count = toFiniteNumber(line.reelCount);
      const weight = toFiniteNumber(line.totalWeightKg);
      const rate = toFiniteNumber(line.ratePerKg);
      const freight = line.freightCharges === undefined ? 0 : toFiniteNumber(line.freightCharges);
      const other = line.otherCharges === undefined ? 0 : toFiniteNumber(line.otherCharges);

      return !Number.isFinite(width) || width <= 0 ||
        !Number.isFinite(bf) || bf <= 0 ||
        !Number.isFinite(gsm) || gsm <= 0 ||
        !Number.isInteger(count) || count <= 0 ||
        !Number.isFinite(weight) || weight <= 0 ||
        !Number.isFinite(rate) || rate < 0 ||
        !Number.isFinite(freight) || freight < 0 ||
        !Number.isFinite(other) || other < 0;
    });

    if (invalidLine) {
      return res.status(400).json({
        message: 'Each inward line needs positive reel dimensions, a whole reel count, positive total weight, and non-negative rate and charges.'
      });
    }

    let normalizedLines;
    try {
      normalizedLines = lines.map((line) => ({
        ...line,
        ...normalizeInwardReelWeights({
          reelCount: line.reelCount,
          totalWeightKg: line.totalWeightKg,
          reelWeightsKg: line.reelWeightsKg
        })
      }));
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }

    const supplier = await Party.findById(supplierId);
    if (!supplier || !['Supplier', 'Both'].includes(supplier.type)) {
      return res.status(400).json({ message: 'Invalid or non-supplier party selected.' });
    }

    // Allocate receipt numbers through the shared atomic sequence, not count + 1.
    const existingCount = await InwardReceipt.countDocuments();
    const sequence = await Sequence.findOneAndUpdate(
      { _id: 'inward-receipt' },
      [{ $set: { value: { $add: [{ $max: [{ $ifNull: ['$value', existingCount] }, existingCount] }, 1] } } }],
      { new: true, upsert: true }
    );
    const receiptNumber = `IR-${String(sequence.value).padStart(5, '0')}`;

    const receipt = await InwardReceipt.create({
      receiptNumber,
      receiptDate: parsedReceiptDate,
      supplierId,
      invoiceReference: invoiceReference.trim(),
      notes,
      lines: normalizedLines,
      status: 'draft'
    });

    await writeAuditLog(req, { action: 'inward.draft_created', entityType: 'InwardReceipt', entityId: receipt._id, entityLabel: receipt.receiptNumber, summary: 'Inward receipt draft created: ' + receipt.receiptNumber, metadata: { supplierId: String(supplierId), invoiceReference: invoiceReference.trim(), lineCount: normalizedLines.length } });
    return res.status(201).json({ message: 'Inward receipt draft saved successfully', receipt });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'An inward receipt with this supplier and invoice reference already exists, or a receipt number was allocated concurrently. Please retry.' });
    }
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ message: 'Inward receipt contains invalid data.' });
    }
    console.error('[INWARD] Draft creation failed:', error.message);
    return res.status(500).json({ message: 'Error creating inward receipt draft' });
  }
};

// Get all receipts
exports.getReceipts = async (req, res) => {
  try {
    const filter = buildDateRangeFilter(req.query.from, req.query.to, 'receiptDate');
    if (req.query.supplierId) {
      if (!mongoose.isValidObjectId(req.query.supplierId)) return res.status(400).json({ message: 'Invalid supplier ID.' });
      filter.supplierId = req.query.supplierId;
    }
    if (req.query.status && !['draft', 'posted', 'cancelled'].includes(req.query.status)) return res.status(400).json({ message: 'Invalid receipt status.' });
    if (req.query.status) filter.status = req.query.status;
    const receipts = await InwardReceipt.find(filter).populate('supplierId', 'name gstin').sort({ receiptDate: -1, createdAt: -1 }).limit(1000);
    return res.json({ receipts });
  } catch (error) {
    console.error('[INWARD] Receipt query failed:', error.message);
    return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Error fetching receipts' });
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
        const bf = Number(line.bf);
        const gsm = Number(line.gsm);
        const rate = Number(line.ratePerKg.toString());
        try {
          normalizeInwardReelWeights({
            reelCount: qty,
            totalWeightKg: weightNum,
            reelWeightsKg: line.reelWeightsKg
          });
        } catch (error) {
          const invalidWeights = new Error(error.message);
          invalidWeights.statusCode = 400;
          throw invalidWeights;
        }
        if (!Number.isInteger(qty) || qty <= 0 ||
            !Number.isFinite(weightNum) || weightNum <= 0 ||
            !Number.isFinite(width) || width <= 0 ||
            !Number.isFinite(bf) || bf <= 0 ||
            !Number.isFinite(gsm) || gsm <= 0 ||
            !Number.isFinite(rate) || rate < 0) {
          const error = new Error('Receipt contains an invalid line. Correct the draft before posting.');
          error.statusCode = 400;
          throw error;
        }
      }

      const existingReelCount = await ReelUnit.countDocuments().session(session);
      const totalReelsToCreate = receipt.lines.reduce((sum, line) => sum + Number(line.reelCount), 0);
      const reelSequence = await Sequence.findOneAndUpdate(
        { _id: 'reel-unit' },
        [{ $set: { value: { $add: [{ $max: [{ $ifNull: ['$value', existingReelCount] }, existingReelCount] }, totalReelsToCreate] } } }],
        { new: true, upsert: true, session }
      );
      let reelCounter = reelSequence.value - totalReelsToCreate;

      for (const line of receipt.lines) {
        const weightNum = Number(line.totalWeightKg.toString());
        const qty = Number(line.reelCount);
        const { reelWeightsKg } = normalizeInwardReelWeights({
          reelCount: qty,
          totalWeightKg: weightNum,
          reelWeightsKg: line.reelWeightsKg
        });
        const landedRatePerKg = calculateLandedRatePerKg({
          ratePerKg: Number(line.ratePerKg.toString()),
          freightCharges: Number(line.freightCharges?.toString() || 0),
          otherCharges: Number(line.otherCharges?.toString() || 0),
          totalWeightKg: weightNum
        });

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
            originalWeightKg: reelWeightsKg[i],
            remainingWeightKg: reelWeightsKg[i],
            ratePerKg: line.ratePerKg,
            landedRatePerKg,
            status: 'available'
          }], { session });
        }

        await StockMovement.create([{
          movementDate: receipt.receiptDate,
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

      await writeAuditLog(req, { action: 'inward.posted', entityType: 'InwardReceipt', entityId: receipt._id, entityLabel: receipt.receiptNumber, summary: 'Inward receipt posted: ' + receipt.receiptNumber, metadata: { supplierId: String(receipt.supplierId), invoiceReference: receipt.invoiceReference, reelCount: totalReelsToCreate } }, session);
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
