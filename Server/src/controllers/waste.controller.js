const mongoose = require('mongoose');
const ProductionRun = require('../models/ProductionRun.model');
const ScrapSale = require('../models/ScrapSale.model');
const WasteInventory = require('../models/WasteInventory.model');
const { calculateScrapAvailability } = require('../utils/productionAccounting');
const writeAuditLog = require('../utils/writeAuditLog');
const { buildDateRangeFilter } = require('../utils/dateFilters');

const asNumber = (value) => {
  if (value === null || value === undefined) return 0;
  return Number(value.toString());
};

exports.getWasteStats = async (req, res) => {
  try {
    const productionFilter = {
      recoverableWasteKg: { $gt: 0 },
      ...buildDateRangeFilter(req.query.from, req.query.to, 'runDate')
    };
    const salesFilter = buildDateRangeFilter(req.query.from, req.query.to, 'saleDate');
    const [productionWaste, scrapSales, legacyRows, allTimeGeneratedRows, allTimeSoldRows] = await Promise.all([
      ProductionRun.find(productionFilter)
        .sort({ runDate: -1, createdAt: -1 })
        .limit(1000)
        .select('runNumber runDate createdAt recoverableWasteKg processLossKg operatorName')
        .lean(),
      ScrapSale.find(salesFilter).sort({ saleDate: -1, createdAt: -1 }).limit(1000).lean(),
      ProductionRun.aggregate([
        { $match: { recoverableWasteKg: { $exists: false }, wasteGeneratedKg: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$wasteGeneratedKg' } } }
      ]),
      ProductionRun.aggregate([
        { $group: { _id: null, total: { $sum: { $ifNull: ['$recoverableWasteKg', 0] } } } }
      ]),
      ScrapSale.aggregate([
        { $group: { _id: null, total: { $sum: '$weightSoldKg' } } }
      ])
    ]);

    const totalWasteGenerated = productionWaste.reduce((sum, run) => sum + asNumber(run.recoverableWasteKg), 0);
    const totalWasteSold = scrapSales.reduce((sum, sale) => sum + asNumber(sale.weightSoldKg), 0);
    const allTimeGenerated = asNumber(allTimeGeneratedRows[0] && allTimeGeneratedRows[0].total);
    const allTimeSold = asNumber(allTimeSoldRows[0] && allTimeSoldRows[0].total);
    const legacyUnverifiedWasteKg = asNumber(legacyRows[0] && legacyRows[0].total);
    const currentWasteInventory = calculateScrapAvailability(allTimeGenerated, allTimeSold);

    const verifiedRuns = productionWaste.map((run) => ({
      ...run,
      recoverableWasteKg: asNumber(run.recoverableWasteKg),
      processLossKg: asNumber(run.processLossKg)
    }));

    return res.json({
      currentWasteInventory,
      totalWasteGenerated,
      totalWasteSold,
      allTimeWasteGenerated: allTimeGenerated,
      allTimeWasteSold: allTimeSold,
      legacyUnverifiedWasteKg,
      productionWaste: verifiedRuns,
      scrapSales,
      period: { from: req.query.from || null, to: req.query.to || null }
    });
  } catch (error) {
    console.error('[WASTE] Stats query failed:', error.message);
    return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Error fetching waste statistics' });
  }
};

exports.recordScrapSale = async (req, res) => {
  const buyerName = typeof req.body?.buyerName === 'string' ? req.body.buyerName.trim() : '';
  const weightSoldKg = Number(req.body?.weightSoldKg);
  const ratePerKg = Number(req.body?.ratePerKg);

  if (!buyerName || !Number.isFinite(weightSoldKg) || weightSoldKg <= 0 || !Number.isFinite(ratePerKg) || ratePerKg < 0) {
    return res.status(400).json({ message: 'Buyer, a positive sale weight and a non-negative rate are required.' });
  }

  const session = await mongoose.startSession();
  try {
    let createdSale;
    await session.withTransaction(async () => {
      await WasteInventory.findOneAndUpdate(
        { _id: 'waste-stock' },
        { $inc: { revision: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true, session }
      );

      const [generatedRows, soldRows] = await Promise.all([
        ProductionRun.aggregate([
          { $group: { _id: null, total: { $sum: { $ifNull: ['$recoverableWasteKg', 0] } } } }
        ]).session(session),
        ScrapSale.aggregate([
          { $group: { _id: null, total: { $sum: '$weightSoldKg' } } }
        ]).session(session)
      ]);

      const generated = asNumber(generatedRows[0] && generatedRows[0].total);
      const sold = asNumber(soldRows[0] && soldRows[0].total);
      const available = calculateScrapAvailability(generated, sold);

      if (weightSoldKg > available) {
        const error = new Error('Insufficient verified scrap stock. Available: ' + available.toFixed(2) + ' kg; requested: ' + weightSoldKg.toFixed(2) + ' kg. Legacy unverified production variance is excluded until reconciled.');
        error.statusCode = 409;
        throw error;
      }

      const totalAmount = Math.round(weightSoldKg * ratePerKg * 100) / 100;
      const [sale] = await ScrapSale.create([{
        buyerName,
        weightSoldKg,
        ratePerKg,
        totalAmount,
        recordedBy: req.user._id
      }], { session });
      await writeAuditLog(req, { action: 'scrap.sale_recorded', entityType: 'ScrapSale', entityId: sale._id, entityLabel: sale.buyerName, summary: 'Scrap sold to ' + sale.buyerName + ': ' + weightSoldKg.toFixed(2) + ' kg', metadata: { weightSoldKg, ratePerKg, totalAmount } }, session);
      createdSale = sale;
    });

    return res.status(201).json({ message: 'Scrap sale recorded successfully', sale: createdSale });
  } catch (error) {
    console.error('[SCRAP SALE] Transaction failed:', error.message);
    return res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : 'Error recording scrap sale'
    });
  } finally {
    await session.endSession();
  }
};
