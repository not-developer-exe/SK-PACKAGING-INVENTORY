const mongoose = require('mongoose');
const ProductionRun = require('../models/ProductionRun.model');
const ScrapSale = require('../models/ScrapSale.model');
const WasteInventory = require('../models/WasteInventory.model');

exports.getWasteStats = async (req, res) => {
  try {
    const [productionWaste, scrapSales] = await Promise.all([
      ProductionRun.find({ wasteGeneratedKg: { $gt: 0 } })
        .sort({ createdAt: -1 })
        .select('runNumber createdAt wasteGeneratedKg operatorName')
        .lean(),
      ScrapSale.find().sort({ createdAt: -1 }).lean()
    ]);

    const totalWasteGenerated = productionWaste.reduce((sum, run) => sum + Number(run.wasteGeneratedKg || 0), 0);
    const totalWasteSold = scrapSales.reduce((sum, sale) => sum + Number(sale.weightSoldKg || 0), 0);
    const currentWasteInventory = Math.max(0, totalWasteGenerated - totalWasteSold);

    return res.json({ currentWasteInventory, totalWasteGenerated, totalWasteSold, productionWaste, scrapSales });
  } catch (error) {
    console.error('[WASTE] Stats query failed:', error.message);
    return res.status(500).json({ message: 'Error fetching waste statistics' });
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
      // Touch one shared document inside the transaction. Concurrent sales
      // contend on this write, preventing overselling under parallel requests.
      await WasteInventory.findOneAndUpdate(
        { _id: 'waste-stock' },
        { $inc: { revision: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true, session }
      );

      const [generatedRows, soldRows] = await Promise.all([
        ProductionRun.aggregate([
          { $match: { wasteGeneratedKg: { $gt: 0 } } },
          { $group: { _id: null, total: { $sum: '$wasteGeneratedKg' } } }
        ]).session(session),
        ScrapSale.aggregate([
          { $group: { _id: null, total: { $sum: '$weightSoldKg' } } }
        ]).session(session)
      ]);

      const generated = Number(generatedRows[0]?.total || 0);
      const sold = Number(soldRows[0]?.total || 0);
      const available = Math.max(0, generated - sold);

      if (weightSoldKg > available) {
        const error = new Error(`Insufficient waste stock. Available: ${available.toFixed(2)} kg; requested: ${weightSoldKg.toFixed(2)} kg.`);
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
