const mongoose = require('mongoose');
const ProductionRun = require('../models/ProductionRun.model');
const ScrapSale = require('../models/ScrapSale.model');
const ThakEntry = require('../models/ThakEntry.model');
const WasteInventory = require('../models/WasteInventory.model');
const { calculateScrapAvailability } = require('../utils/productionAccounting');
const writeAuditLog = require('../utils/writeAuditLog');
const { buildDateRangeFilter, isValidDateOnly } = require('../utils/dateFilters');

const asNumber = (value) => {
  if (value === null || value === undefined) return 0;
  return Number(value.toString());
};

const sumField = (rows, field) => asNumber(rows[0] && rows[0][field]);

exports.getWasteStats = async (req, res) => {
  try {
    const productionFilter = {
      recoverableWasteKg: { $gt: 0 },
      ...buildDateRangeFilter(req.query.from, req.query.to, 'runDate')
    };
    const salesFilter = buildDateRangeFilter(req.query.from, req.query.to, 'saleDate');
    if (req.query.buyerName) salesFilter.buyerName = String(req.query.buyerName).trim();

    const [
      productionWaste, scrapSales, thakEntries, legacyRows,
      allTimeGeneratedRows, allTimeScrapSoldRows, allTimeThakEnteredRows, allTimeThakSoldRows
    ] = await Promise.all([
      ProductionRun.find(productionFilter).sort({ runDate: -1, createdAt: -1 }).limit(1000)
        .select('runNumber runDate createdAt recoverableWasteKg processLossKg operatorName totalMaterialCost totalInputWeightKg materialCostPerInputKg recoverableWasteMaterialCost processLossMaterialCost wasteCostingStatus wasteBreakdown').lean(),
      ScrapSale.find({ ...salesFilter, saleType: { $ne: 'thak' } }).sort({ saleDate: -1, createdAt: -1 }).limit(1000).lean(),
      ThakEntry.find(buildDateRangeFilter(req.query.from, req.query.to, 'entryDate')).sort({ entryDate: -1, createdAt: -1 }).limit(1000).lean(),
      ProductionRun.aggregate([
        { $match: { recoverableWasteKg: { $exists: false }, wasteGeneratedKg: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$wasteGeneratedKg' } } }
      ]),
      ProductionRun.aggregate([{ $group: { _id: null, total: { $sum: { $ifNull: ['$recoverableWasteKg', 0] } } } }]),
      ScrapSale.aggregate([{ $match: { saleType: { $ne: 'thak' } } }, { $group: { _id: null, total: { $sum: '$weightSoldKg' } } }]),
      ThakEntry.aggregate([{ $group: { _id: null, total: { $sum: '$weightKg' } } }]),
      ScrapSale.aggregate([{ $match: { saleType: 'thak' } }, { $group: { _id: null, total: { $sum: '$weightSoldKg' } } }])
    ]);

    const totalWasteGenerated = productionWaste.reduce((sum, run) => sum + asNumber(run.recoverableWasteKg), 0);
    const totalWasteSold = scrapSales.reduce((sum, sale) => sum + asNumber(sale.weightSoldKg), 0);
    const allTimeGenerated = sumField(allTimeGeneratedRows, 'total');
    const allTimeScrapSold = sumField(allTimeScrapSoldRows, 'total');
    const allTimeThakEntered = sumField(allTimeThakEnteredRows, 'total');
    const allTimeThakSold = sumField(allTimeThakSoldRows, 'total');
    const legacyUnverifiedWasteKg = sumField(legacyRows, 'total');

    const verifiedRuns = productionWaste.map((run) => ({
      ...run,
      recoverableWasteKg: asNumber(run.recoverableWasteKg),
      processLossKg: asNumber(run.processLossKg),
      materialCostPerInputKg: asNumber(run.materialCostPerInputKg),
      recoverableWasteMaterialCost: asNumber(run.recoverableWasteMaterialCost),
      processLossMaterialCost: asNumber(run.processLossMaterialCost),
      wasteCostingStatus: run.wasteCostingStatus || 'pending',
      wasteBreakdown: (run.wasteBreakdown || []).map((row) => ({ ...row, weightKg: asNumber(row.weightKg), materialCost: asNumber(row.materialCost) }))
    }));
    const totalWasteMaterialCost = verifiedRuns.reduce((sum, run) => sum + (run.wasteCostingStatus === 'available' ? run.recoverableWasteMaterialCost : 0), 0);
    const pendingWasteCostingRuns = verifiedRuns.filter((run) => run.recoverableWasteKg > 0 && run.wasteCostingStatus !== 'available').length;

    return res.json({
      currentWasteInventory: calculateScrapAvailability(allTimeGenerated, allTimeScrapSold),
      currentThakInventory: calculateScrapAvailability(allTimeThakEntered, allTimeThakSold),
      totalWasteGenerated,
      totalWasteSold,
      totalThakEntered: thakEntries.reduce((sum, entry) => sum + asNumber(entry.weightKg), 0),
      totalThakSold: allTimeThakSold,
      totalWasteMaterialCost: Number(totalWasteMaterialCost.toFixed(2)),
      pendingWasteCostingRuns,
      allTimeWasteGenerated: allTimeGenerated,
      allTimeWasteSold: allTimeScrapSold,
      allTimeThakEntered,
      allTimeThakSold,
      legacyUnverifiedWasteKg,
      productionWaste: verifiedRuns,
      scrapSales,
      thakEntries,
      thakSales: await ScrapSale.find({ ...salesFilter, saleType: 'thak' }).sort({ saleDate: -1, createdAt: -1 }).limit(1000).lean(),
      period: { from: req.query.from || null, to: req.query.to || null }
    });
  } catch (error) {
    console.error('[WASTE] Stats query failed:', error.message);
    return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Error fetching waste statistics' });
  }
};

exports.recordThakEntry = async (req, res) => {
  const rawEntryDate = req.body?.entryDate;
  if (rawEntryDate !== undefined && !isValidDateOnly(rawEntryDate)) {
    return res.status(400).json({ message: 'Thak entry date must be a real calendar date in YYYY-MM-DD format.' });
  }
  const entryDate = rawEntryDate ? new Date(rawEntryDate + 'T00:00:00+05:30') : new Date();
  const weightKg = Number(req.body?.weightKg);
  const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : '';
  if (!Number.isFinite(weightKg) || weightKg <= 0 || notes.length > 500) {
    return res.status(400).json({ message: 'Enter a positive Thak weight and notes no longer than 500 characters.' });
  }

  const session = await mongoose.startSession();
  try {
    let createdEntry;
    await session.withTransaction(async () => {
      await WasteInventory.findOneAndUpdate(
        { _id: 'waste-stock' }, { $inc: { revision: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true, session }
      );
      const [entry] = await ThakEntry.create([{ entryDate, weightKg, notes, recordedBy: req.user._id }], { session });
      await writeAuditLog(req, {
        action: 'thak.stock_recorded', entityType: 'ThakEntry', entityId: entry._id,
        entityLabel: 'Thak ' + weightKg.toFixed(2) + ' kg',
        summary: 'Recorded moisture-damaged paper (Thak): ' + weightKg.toFixed(2) + ' kg',
        metadata: { weightKg, entryDate, notes }
      }, session);
      createdEntry = entry;
    });
    return res.status(201).json({ message: 'Thak stock recorded successfully', entry: createdEntry });
  } catch (error) {
    console.error('[THAK] Stock entry failed:', error.message);
    return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Error recording Thak stock' });
  } finally {
    await session.endSession();
  }
};

exports.recordScrapSale = async (req, res) => {
  const buyerName = typeof req.body?.buyerName === 'string' ? req.body.buyerName.trim() : '';
  const rawSaleDate = req.body?.saleDate;
  const saleType = req.body?.saleType === 'thak' ? 'thak' : 'scrap';
  if (rawSaleDate !== undefined && !isValidDateOnly(rawSaleDate)) {
    return res.status(400).json({ message: 'Sale date must be a real calendar date in YYYY-MM-DD format.' });
  }
  const saleDate = rawSaleDate ? new Date(rawSaleDate + 'T00:00:00+05:30') : new Date();
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
        { _id: 'waste-stock' }, { $inc: { revision: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true, session }
      );

      let generated = 0;
      let sold = 0;
      if (saleType === 'thak') {
        const [enteredRows, soldRows] = await Promise.all([
          ThakEntry.aggregate([{ $group: { _id: null, total: { $sum: '$weightKg' } } }]).session(session),
          ScrapSale.aggregate([{ $match: { saleType: 'thak' } }, { $group: { _id: null, total: { $sum: '$weightSoldKg' } } }]).session(session)
        ]);
        generated = sumField(enteredRows, 'total');
        sold = sumField(soldRows, 'total');
      } else {
        const [generatedRows, soldRows] = await Promise.all([
          ProductionRun.aggregate([{ $group: { _id: null, total: { $sum: { $ifNull: ['$recoverableWasteKg', 0] } } } }]).session(session),
          ScrapSale.aggregate([{ $match: { saleType: { $ne: 'thak' } } }, { $group: { _id: null, total: { $sum: '$weightSoldKg' } } }]).session(session)
        ]);
        generated = sumField(generatedRows, 'total');
        sold = sumField(soldRows, 'total');
      }
      const available = calculateScrapAvailability(generated, sold);
      if (weightSoldKg > available) {
        const label = saleType === 'thak' ? 'Thak' : 'verified scrap';
        const error = new Error('Insufficient ' + label + ' stock. Available: ' + available.toFixed(2) + ' kg; requested: ' + weightSoldKg.toFixed(2) + ' kg.');
        error.statusCode = 409;
        throw error;
      }

      const totalAmount = Math.round(weightSoldKg * ratePerKg * 100) / 100;
      const [sale] = await ScrapSale.create([{
        saleDate, saleType, buyerName, weightSoldKg, ratePerKg, totalAmount, recordedBy: req.user._id
      }], { session });
      await writeAuditLog(req, {
        action: saleType === 'thak' ? 'thak.sale_recorded' : 'scrap.sale_recorded',
        entityType: 'ScrapSale', entityId: sale._id, entityLabel: sale.buyerName,
        summary: (saleType === 'thak' ? 'Thak' : 'Scrap') + ' sold to ' + sale.buyerName + ': ' + weightSoldKg.toFixed(2) + ' kg',
        metadata: { saleType, weightSoldKg, ratePerKg, totalAmount }
      }, session);
      createdSale = sale;
    });
    return res.status(201).json({ message: (saleType === 'thak' ? 'Thak' : 'Scrap') + ' sale recorded successfully', sale: createdSale });
  } catch (error) {
    console.error('[WASTE SALE] Transaction failed:', error.message);
    return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Error recording sale' });
  } finally {
    await session.endSession();
  }
};
