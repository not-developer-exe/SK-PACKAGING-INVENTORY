const ProductionRun = require('../models/ProductionRun.model');
const CorrugatedSheet = require('../models/CorrugatedSheet.model');
const FinishedBox = require('../models/FinishedBox.model');
const Dispatch = require('../models/Dispatch.model');
const Invoice = require('../models/Invoice.model');
const ReelUnit = require('../models/ReelUnit.model');
const { buildDateRangeFilter } = require('../utils/dateFilters');

exports.performance = async (req, res) => {
  try {
    const runs = await ProductionRun.find(buildDateRangeFilter(req.query.from, req.query.to, 'runDate'))
      .select('machineName shift operatorName totalInputWeightKg totalOutputWeightKg recoverableWasteKg processLossKg totalMaterialCost')
      .lean();

    const group = (key) => {
      const grouped = new Map();
      for (const run of runs) {
        const name = (run[key] || 'Not recorded').trim();
        const row = grouped.get(name) || {
          name, runs: 0, inputKg: 0, outputKg: 0, scrapKg: 0, processLossKg: 0, materialCost: 0
        };
        row.runs += 1;
        row.inputKg += Number(run.totalInputWeightKg || 0);
        row.outputKg += Number(run.totalOutputWeightKg || 0);
        row.scrapKg += Number(run.recoverableWasteKg || 0);
        row.processLossKg += Number(run.processLossKg || 0);
        row.materialCost += Number(run.totalMaterialCost || 0);
        grouped.set(name, row);
      }
      return [...grouped.values()]
        .map((row) => ({
          ...row,
          inputKg: Number(row.inputKg.toFixed(3)),
          outputKg: Number(row.outputKg.toFixed(3)),
          scrapKg: Number(row.scrapKg.toFixed(3)),
          processLossKg: Number(row.processLossKg.toFixed(3)),
          materialCost: Number(row.materialCost.toFixed(2)),
          yieldPercent: row.inputKg ? Number((row.outputKg / row.inputKg * 100).toFixed(2)) : 0
        }))
        .sort((a, b) => b.outputKg - a.outputKg);
    };

    return res.json({
      summary: { runs: runs.length },
      byMachine: group('machineName'),
      byShift: group('shift'),
      byOperator: group('operatorName')
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : 'Unable to calculate production performance.'
    });
  }
};

exports.trace = async (req, res) => {
  try {
    const key = String(req.query.batchNumber || '').trim();
    if (!key) return res.status(400).json({ message: 'Enter a finished-goods batch number.' });

    const box = await FinishedBox.findOne({ batchNumber: key })
      .populate('customerId', 'name')
      .populate('productionPlanId', 'planNumber dueDate plannedBoxes completedBoxes')
      .lean();
    if (!box) return res.status(404).json({ message: 'Finished-goods batch not found.' });

    const sheet = await CorrugatedSheet.findById(box.sourceSheetId).lean();
    const run = sheet ? await ProductionRun.findById(sheet.productionRunId).lean() : null;
    const reels = run?.inputReels?.length
      ? await ReelUnit.find({ _id: { $in: run.inputReels.map((item) => item.reelId) } })
        .select('reelCode sourceType batchReference inwardReceiptId openingStockAdjustmentId supplierId originalWeightKg remainingWeightKg status reelWidthInches bf gsm quality')
        .populate('inwardReceiptId', 'receiptNumber receiptDate invoiceReference')
        .populate('openingStockAdjustmentId', 'adjustmentNumber adjustmentDate')
        .populate('supplierId', 'name')
        .lean()
      : [];

    const dispatches = await Dispatch.find({ 'boxes.boxId': box._id })
      .select('challanNumber dispatchDate boxes vehicleNumber driverName status deliveredAt deliveredBy deliveryNotes cancelledAt cancelledBy cancellationReason')
      .populate('deliveredBy', 'name')
      .populate('cancelledBy', 'name')
      .lean();
    const invoices = await Invoice.find({ dispatchId: { $in: dispatches.map((dispatch) => dispatch._id) } })
      .select('invoiceNumber invoiceDate grandTotal balanceDue status')
      .lean();

    return res.json({ trace: { finishedBatch: box, sheet, productionRun: run, reels, dispatches, invoices } });
  } catch (error) {
    console.error('[TRACE] Manufacturing trace failed:', error.message);
    return res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : 'Unable to build manufacturing trace.'
    });
  }
};
