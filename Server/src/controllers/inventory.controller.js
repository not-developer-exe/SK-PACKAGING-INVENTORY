const ReelUnit = require("../models/ReelUnit.model");

exports.getLiveReelStock = async (req, res) => {
  try {
    const stockAggregation = await ReelUnit.aggregate([
      // 1. Only count reels that are not fully consumed
      { $match: { status: { $in: ["available", "partial"] } } },
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
      .find({ status: { $in: ["available", "partial"] } })
      .populate("supplierId", "name")
      .sort({ createdAt: 1 }); // Oldest reels first (FIFO)
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
