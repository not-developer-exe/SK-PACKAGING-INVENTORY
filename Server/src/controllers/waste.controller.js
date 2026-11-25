const mongoose = require('mongoose');
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
    const salesFilter = buildDateRangeFilter(req.query.from, req.query.to, 'saleDate');
    if (req.query.buyerName) salesFilter.buyerName = String(req.query.buyerName).trim();
    const [scrapSales, thakSales, thakEntries, allTimeThakEnteredRows, allTimeThakSoldRows] = await Promise.all([
      ScrapSale.find({ ...salesFilter, saleType: { $ne: 'thak' } }).sort({ saleDate: -1, createdAt: -1 }).limit(1000).lean(),
      ScrapSale.find({ ...salesFilter, saleType: 'thak' }).sort({ saleDate: -1, createdAt: -1 }).limit(1000).lean(),
      ThakEntry.find(buildDateRangeFilter(req.query.from, req.query.to, 'entryDate')).sort({ entryDate: -1, createdAt: -1 }).limit(1000).lean(),
      ThakEntry.aggregate([{ $group: { _id: null, total: { $sum: '$weightKg' } } }]),
      ScrapSale.aggregate([{ $match: { saleType: 'thak' } }, { $group: { _id: null, total: { $sum: '$weightSoldKg' } } }])
    ]);
    const allTimeThakEntered = sumField(allTimeThakEnteredRows, 'total');
    const allTimeThakSold = sumField(allTimeThakSoldRows, 'total');
    const totalScrapSold = scrapSales.reduce((sum, sale) => sum + asNumber(sale.weightSoldKg), 0);
    const totalScrapSalesAmount = Number(scrapSales.reduce((sum, sale) => sum + asNumber(sale.totalAmount), 0).toFixed(2));
    const totalThakEntered = thakEntries.reduce((sum, entry) => sum + asNumber(entry.weightKg), 0);
    const totalThakSold = thakSales.reduce((sum, sale) => sum + asNumber(sale.weightSoldKg), 0);
    const totalThakSalesAmount = Number(thakSales.reduce((sum, sale) => sum + asNumber(sale.totalAmount), 0).toFixed(2));

    return res.json({
      currentThakInventory: calculateScrapAvailability(allTimeThakEntered, allTimeThakSold),
      totalScrapSold,
      totalScrapSalesAmount,
      totalThakEntered,
      totalThakSold,
      totalThakSalesAmount,
      allTimeThakEntered,
      allTimeThakSold,
      scrapSales,
      thakEntries,
      thakSales,
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
  const ratePerKg = Number(req.body?.ratePerKg || 0);
  const totalValue = Math.round(weightKg * ratePerKg * 100) / 100;
  const entryType = req.body?.entryType === 'opening_balance' ? 'opening_balance' : 'production';
  const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : '';
  if (entryType === 'opening_balance' && req.user?.role !== 'admin') return res.status(403).json({ message: 'Only an admin can post opening Thak stock.' });
  if (!Number.isFinite(weightKg) || weightKg <= 0 || !Number.isFinite(ratePerKg) || ratePerKg < 0 || notes.length > 500) {
    return res.status(400).json({ message: 'Enter a positive Thak weight and notes no longer than 500 characters.' });
  }

  const session = await mongoose.startSession();
  try {
    let createdEntry;
    await session.withTransaction(async () => {
      const companyKey = req.companyKey || 'sk-packaging';
      if (entryType === 'opening_balance' && await ThakEntry.exists({ companyKey, entryType: 'opening_balance' }).session(session)) {
        const error = new Error('Opening Thak stock has already been posted for this company.'); error.statusCode = 409; throw error;
      }
      await WasteInventory.findOneAndUpdate(
        { _id: 'waste-stock' }, { $inc: { revision: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true, session }
      );
      const [entry] = await ThakEntry.create([{ companyKey, entryDate, entryType, weightKg, ratePerKg, totalValue, notes: entryType === 'opening_balance' ? (notes || 'Opening Thak stock imported from STOCK oct.(3).xlsx') : notes, recordedBy: req.user._id }], { session });
      await writeAuditLog(req, {
        action: entryType === 'opening_balance' ? 'thak.opening_stock_recorded' : 'thak.stock_recorded', entityType: 'ThakEntry', entityId: entry._id,
        entityLabel: 'Thak ' + weightKg.toFixed(2) + ' kg',
        summary: (entryType === 'opening_balance' ? 'Opening Thak balance recorded: ' : 'Recorded moisture-damaged paper (Thak): ') + weightKg.toFixed(2) + ' kg',
        metadata: { weightKg, ratePerKg, totalValue, entryDate, entryType, notes }
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
  const saleType = req.body?.saleType ?? 'scrap';
  if (!['scrap', 'thak'].includes(saleType)) {
    return res.status(400).json({ message: 'Sale type must be either normal scrap or Thak.' });
  }
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

      // Normal scrap is recorded only when sold; the factory does not maintain
      // production-stage scrap stock. Thak is weighed into its own stock ledger.
      if (saleType === 'thak') {
        const enteredRows = await ThakEntry.aggregate([{ $group: { _id: null, total: { $sum: '$weightKg' } } }]).session(session);
        const soldRows = await ScrapSale.aggregate([{ $match: { saleType: 'thak' } }, { $group: { _id: null, total: { $sum: '$weightSoldKg' } } }]).session(session);
        const available = calculateScrapAvailability(sumField(enteredRows, 'total'), sumField(soldRows, 'total'));
        if (weightSoldKg > available) {
          const error = new Error('Insufficient Thak stock. Available: ' + available.toFixed(2) + ' kg; requested: ' + weightSoldKg.toFixed(2) + ' kg.');
          error.statusCode = 409;
          throw error;
        }
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
