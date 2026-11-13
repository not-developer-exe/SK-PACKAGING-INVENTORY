const ReelUnit = require('../models/ReelUnit.model');
const FinishedBox = require('../models/FinishedBox.model');
const ProductionRun = require('../models/ProductionRun.model');
const Dispatch = require('../models/Dispatch.model');

const numericValue = (field) => ({
  $convert: { input: field, to: 'double', onError: 0, onNull: 0 }
});

exports.getDashboardStats = async (req, res) => {
  try {
    const monthParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit'
    }).formatToParts(new Date());
    const year = monthParts.find((part) => part.type === 'year').value;
    const month = monthParts.find((part) => part.type === 'month').value;
    const startOfMonth = new Date(`${year}-${month}-01T00:00:00+05:30`);
    const nextMonth = new Date(Number(month) === 12
      ? `${Number(year) + 1}-01-01T00:00:00+05:30`
      : `${year}-${String(Number(month) + 1).padStart(2, '0')}-01T00:00:00+05:30`);

    const [reelStats, boxStats, wasteStats, recentDispatches] = await Promise.all([
      ReelUnit.aggregate([
        { $match: { status: { $in: ['available', 'partial'] } } },
        { $group: {
          _id: null,
          totalReels: { $sum: 1 },
          totalWeight: { $sum: numericValue('$remainingWeightKg') }
        } }
      ]),
      FinishedBox.aggregate([
        { $match: { quantityAvailable: { $gt: 0 } } },
        { $group: {
          _id: null,
          totalBatches: { $sum: 1 },
          totalBoxes: { $sum: { $convert: { input: '$quantityAvailable', to: 'double', onError: 0, onNull: 0 } } }
        } }
      ]),
      ProductionRun.aggregate([
        {
          $match: {
            runDate: {
              $gte: startOfMonth,
              $lt: nextMonth
            }
          }
        },
        { $group: { _id: null, totalWaste: { $sum: numericValue('$wasteGeneratedKg') } } }
      ]),
      Dispatch.find()
        .populate('customerId', 'name')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
    ]);

    return res.json({
      reels: {
        count: reelStats[0]?.totalReels ?? 0,
        weightKg: reelStats[0]?.totalWeight ?? 0
      },
      boxes: {
        batches: boxStats[0]?.totalBatches ?? 0,
        count: boxStats[0]?.totalBoxes ?? 0
      },
      waste: {
        thisMonthKg: wasteStats[0]?.totalWaste ?? 0
      },
      recentActivity: recentDispatches
    });
  } catch (error) {
    console.error('[DASHBOARD ERROR]', error.message);
    return res.status(500).json({ message: 'Unable to load dashboard statistics' });
  }
};