const ReelUnit = require("../models/ReelUnit.model");
const CorrugatedSheet = require("../models/CorrugatedSheet.model");
const CutSheetBatch = require("../models/CutSheetBatch.model");
const FacingMaterialBatch = require("../models/FacingMaterialBatch.model");
const FinishedBox = require("../models/FinishedBox.model");
const RawMaterial = require("../models/RawMaterial.model");
const OpeningStockSnapshot = require("../models/OpeningStockSnapshot.model");

const companyFilter = (req) => req.companyKey === 'nsb-industrial-solutions'
  ? { companyKey: 'nsb-industrial-solutions' }
  : { $or: [{ companyKey: 'sk-packaging' }, { companyKey: { $exists: false } }] };

exports.getLiveReelStock = async (req, res) => {
  try {
    const stockAggregation = await ReelUnit.aggregate([
      // 1. Only count reels that are not fully consumed
      { $match: { status: { $in: ["available", "partial"] }, ...companyFilter(req) } },
      // Use the source document's business date, not the time the reel record was created.
      { $lookup: { from: "inwardreceipts", localField: "inwardReceiptId", foreignField: "_id", as: "inwardReceipt" } },
      { $lookup: { from: "openingstockadjustments", localField: "openingStockAdjustmentId", foreignField: "_id", as: "openingAdjustment" } },
      {
        $addFields: {
          stockReceivedAt: {
            $ifNull: [
              { $arrayElemAt: ["$inwardReceipt.receiptDate", 0] },
              { $ifNull: [{ $arrayElemAt: ["$openingAdjustment.adjustmentDate", 0] }, "$createdAt"] }
            ]
          }
        }
      },
      // 2. Group by exact paper specifications
      {
        $group: {
          _id: {
            width: "$reelWidthInches",
            bf: "$bf",
            gsm: "$gsm",
            quality: "$quality",
          },
          reels: { $sum: 1 },
          // Convert Decimal128 to standard JavaScript numbers for safe JSON sending
          weight: { $sum: { $toDouble: "$remainingWeightKg" } },
          // Grab the date of the newest reel in this category
          lastAdded: { $max: "$stockReceivedAt" },
        },
      },
      // 3. Format the output to perfectly match the React frontend's expectations
      {
        $project: {
          _id: 0,
          id: {
            $concat: [
              { $toString: "$_id.width" },
              "in-",
              { $toString: "$_id.bf" },
              "bf-",
              { $toString: "$_id.gsm" },
              "-",
              "$_id.quality",
            ],
          },
          width: "$_id.width",
          bf: "$_id.bf",
          gsm: "$_id.gsm",
          quality: "$_id.quality",
          reels: 1,
          weight: 1,
          dateAdded: "$lastAdded",
        },
      },
      // 4. Sort by width, then BF
      { $sort: { width: 1, bf: 1, gsm: 1 } },
    ]);

    res.json({ stock: stockAggregation });
  } catch (error) {
    console.error("[INVENTORY ERROR]", error);
    res
      .status(500)
      .json({
        message: "Failed to fetch live reel stock",
        error: error.message,
      });
  }
};

exports.getPhysicalReels = async (req, res) => {
  try {
    const reels = await require("../models/ReelUnit.model")
      .find({ status: { $in: ["available", "partial"] }, ...companyFilter(req) })
      .populate("supplierId", "name")
      .populate("inwardReceiptId", "receiptDate")
      .populate("openingStockAdjustmentId", "adjustmentDate")
      .sort({ createdAt: 1 });

    // FIFO follows the original receipt/stock-entry date, not when a backdated record was entered.
    const receivedAt = (reel) =>
      reel.inwardReceiptId?.receiptDate ||
      reel.openingStockAdjustmentId?.adjustmentDate ||
      reel.createdAt;
    reels.sort((a, b) =>
      new Date(receivedAt(a)).getTime() - new Date(receivedAt(b)).getTime() ||
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    res.json({ reels });
  } catch (error) {
    res
      .status(500)
      .json({
        message: "Failed to fetch physical reels",
        error: error.message,
      });
  }
};


exports.getStockRegisterOverview = async (req, res) => {
  try {
    const scope = companyFilter(req);
    const [reels, corrugatedSheets, cutSheetBatches, facingMaterials, finishedGoods, rawMaterials, openingBaseline] = await Promise.all([
      ReelUnit.find({ ...scope, status: { $in: ['available', 'partial'] }, remainingWeightKg: { $gt: 0 } })
        .populate('supplierId', 'name')
        .populate('inwardReceiptId', 'receiptNumber invoiceReference receiptDate')
        .populate('openingStockAdjustmentId', 'adjustmentDate')
        .sort({ reelCode: 1 }).lean(),
      CorrugatedSheet.find({ ...scope, status: 'available', sheetCount: { $gt: 0 } })
        .populate('productionRunId', 'runNumber runDate')
        .populate('pastingRunId', 'runNumber runDate')
        .sort({ createdAt: -1 }).lean(),
      CutSheetBatch.find({ ...scope, status: { $in: ['available', 'partially_used'] }, remainingSheets: { $gt: 0 } })
        .sort({ cutDate: -1, createdAt: -1 }).lean(),
      FacingMaterialBatch.find({ ...scope, status: { $in: ['available', 'partial'] }, remainingSheets: { $gt: 0 } })
        .sort({ inwardDate: -1, createdAt: -1 }).lean(),
      FinishedBox.find({ ...scope, quantityAvailable: { $gt: 0 } })
        .populate('customerId', 'name')
        .sort({ manufacturedAt: -1, createdAt: -1 }).lean(),
      RawMaterial.find({ ...scope, isActive: true }).sort({ category: 1, name: 1 }).lean(),
      OpeningStockSnapshot.find({ ...scope }).sort({ stockDate: 1, categoryLabel: 1 }).lean()
    ]);

    return res.json({
      stock: {
        reels,
        corrugatedSheets,
        cutSheetBatches,
        facingMaterials,
        finishedGoods,
        rawMaterials,
        openingBaseline
      },
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('[INVENTORY REGISTER] Overview failed:', error.message);
    return res.status(500).json({ message: 'Unable to load the complete stock register.' });
  }
};
