const ReelUnit = require('../models/ReelUnit.model');

const companyFilter = { $or: [{ companyKey: 'sk-packaging' }, { companyKey: { $exists: false } }] };

const paperRatesPipeline = [
  { $match: { ...companyFilter, inwardReceiptId: { $ne: null } } },
  { $lookup: { from: 'inwardreceipts', localField: 'inwardReceiptId', foreignField: '_id', as: 'receipt' } },
  { $unwind: '$receipt' },
  { $match: { 'receipt.status': 'posted' } },
  { $sort: { 'receipt.receiptDate': -1, createdAt: -1 } },
  {
    $group: {
      _id: { width: '$reelWidthInches', bf: '$bf', gsm: '$gsm', quality: '$quality' },
      latestPurchaseRatePerKg: { $first: { $toDouble: '$ratePerKg' } },
      latestLandedRatePerKg: {
        $first: {
          $cond: [
            { $gt: [{ $toDouble: { $ifNull: ['$landedRatePerKg', 0] } }, 0] },
            { $toDouble: '$landedRatePerKg' },
            { $toDouble: '$ratePerKg' }
          ]
        }
      },
      purchaseDate: { $first: '$receipt.receiptDate' },
      supplierId: { $first: '$supplierId' },
      receiptNumber: { $first: '$receipt.receiptNumber' },
      invoiceReference: { $first: '$receipt.invoiceReference' }
    }
  },
  { $lookup: { from: 'parties', localField: 'supplierId', foreignField: '_id', as: 'supplier' } },
  {
    $project: {
      _id: 0,
      width: '$_id.width',
      bf: '$_id.bf',
      gsm: '$_id.gsm',
      quality: '$_id.quality',
      latestPurchaseRatePerKg: 1,
      latestLandedRatePerKg: 1,
      purchaseDate: 1,
      supplierName: { $ifNull: [{ $arrayElemAt: ['$supplier.name', 0] }, null] },
      receiptNumber: 1,
      invoiceReference: 1
    }
  },
  { $sort: { width: 1, bf: 1, gsm: 1, quality: 1 } }
];

const reelStockPipeline = [
  { $match: { ...companyFilter, status: { $in: ['available', 'partial'] } } },
  {
    $group: {
      _id: { width: '$reelWidthInches', bf: '$bf', gsm: '$gsm', quality: '$quality' },
      reelCount: { $sum: 1 },
      remainingWeightKg: { $sum: { $toDouble: '$remainingWeightKg' } },
      stockValueAtLandedRate: {
        $sum: {
          $multiply: [
            { $toDouble: '$remainingWeightKg' },
            {
              $cond: [
                { $gt: [{ $toDouble: { $ifNull: ['$landedRatePerKg', 0] } }, 0] },
                { $toDouble: '$landedRatePerKg' },
                { $toDouble: '$ratePerKg' }
              ]
            }
          ]
        }
      },
      stockValueAtPurchaseRate: {
        $sum: {
          $multiply: [
            { $toDouble: '$remainingWeightKg' },
            { $toDouble: '$ratePerKg' }
          ]
        }
      }
    }
  },
  {
    $project: {
      _id: 0,
      width: '$_id.width',
      bf: '$_id.bf',
      gsm: '$_id.gsm',
      quality: '$_id.quality',
      reelCount: 1,
      remainingWeightKg: { $round: ['$remainingWeightKg', 3] },
      weightedAverageLandedRatePerKg: {
        $cond: [
          { $gt: ['$remainingWeightKg', 0] },
          { $round: [{ $divide: ['$stockValueAtLandedRate', '$remainingWeightKg'] }, 2] },
          0
        ]
      },
      weightedAveragePurchaseRatePerKg: {
        $cond: [
          { $gt: ['$remainingWeightKg', 0] },
          { $round: [{ $divide: ['$stockValueAtPurchaseRate', '$remainingWeightKg'] }, 2] },
          0
        ]
      }
    }
  },
  { $sort: { width: 1, bf: 1, gsm: 1, quality: 1 } }
];

async function buildSnapshot() {
  const [paperRates, reelStock] = await Promise.all([
    ReelUnit.aggregate(paperRatesPipeline),
    ReelUnit.aggregate(reelStockPipeline)
  ]);
  return {
    source: 'SK Packaging ERP',
    companyKey: 'sk-packaging',
    generatedAt: new Date().toISOString(),
    paperRates,
    reelStock
  };
}

exports.getSnapshot = async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    return res.json(await buildSnapshot());
  } catch (error) {
    console.error('[BOX COSTING API] Snapshot failed:', error.message);
    return res.status(500).json({ message: 'Unable to fetch box costing data.' });
  }
};

exports.getPaperRates = async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const paperRates = await ReelUnit.aggregate(paperRatesPipeline);
    return res.json({ generatedAt: new Date().toISOString(), paperRates });
  } catch (error) {
    console.error('[BOX COSTING API] Paper rates failed:', error.message);
    return res.status(500).json({ message: 'Unable to fetch latest paper rates.' });
  }
};

exports.getReelStock = async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const reelStock = await ReelUnit.aggregate(reelStockPipeline);
    return res.json({ generatedAt: new Date().toISOString(), reelStock });
  } catch (error) {
    console.error('[BOX COSTING API] Reel stock failed:', error.message);
    return res.status(500).json({ message: 'Unable to fetch reel stock.' });
  }
};
