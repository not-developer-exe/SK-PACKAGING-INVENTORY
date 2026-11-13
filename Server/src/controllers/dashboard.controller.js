const ReelUnit = require('../models/ReelUnit.model');
const FinishedBox = require('../models/FinishedBox.model');
const ProductionRun = require('../models/ProductionRun.model');
const Dispatch = require('../models/Dispatch.model');

exports.getDashboardStats = async (req, res) => {
  try {
    // 1. Live Reel Stats
    const reelStats = await ReelUnit.aggregate([
      { $match: { status: { $in: ['available', 'partial'] } } },
      { $group: { 
          _id: null, 
          totalReels: { $sum: 1 }, 
          totalWeight: { $sum: { $toDouble: "$remainingWeightKg" } } 
      }}
    ]);

    // 2. Finished Goods Stats
    const boxStats = await FinishedBox.aggregate([
      { $match: { quantityAvailable: { $gt: 0 } } },
      { $group: { 
          _id: null, 
          totalBatches: { $sum: 1 },
          totalBoxes: { $sum: "$quantityAvailable" } 
      }}
    ]);

    // 3. Machine Waste (This Month)
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const wasteStats = await ProductionRun.aggregate([
      { $match: { runDate: { $gte: startOfMonth } } },
      { $group: { 
          _id: null, 
          totalWaste: { $sum: { $toDouble: "$wasteGeneratedKg" } } 
      }}
    ]);

    // 4. Recent Dispatches (Limit to 5 for the activity feed)
    const recentDispatches = await Dispatch.find()
      .populate('customerId', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      reels: {
        count: reelStats[0]?.totalReels || 0,
        weightKg: reelStats[0]?.totalWeight || 0
      },
      boxes: {
        batches: boxStats[0]?.totalBatches || 0,
        count: boxStats[0]?.totalBoxes || 0
      },
      waste: {
        thisMonthKg: wasteStats[0]?.totalWaste || 0
      },
      recentActivity: recentDispatches
    });

  } catch (error) {
    console.error('[DASHBOARD ERROR]', error);
    res.status(500).json({ message: 'Error fetching dashboard stats', error: error.message });
  }
};