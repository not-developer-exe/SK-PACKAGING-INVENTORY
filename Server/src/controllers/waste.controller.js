const ProductionRun = require('../models/ProductionRun.model');
const ScrapSale = require('../models/ScrapSale.model');

exports.getWasteStats = async (req, res) => {
  try {
    // 1. Fetch all production runs that generated waste
    const productionWaste = await ProductionRun.find({ wasteGeneratedKg: { $gt: 0 } })
      .sort({ createdAt: -1 })
      .select('runNumber createdAt wasteGeneratedKg operatorName');

    const totalWasteGenerated = productionWaste.reduce((sum, run) => sum + parseFloat(run.wasteGeneratedKg), 0);

    // 2. Fetch all scrap sales
    const scrapSales = await ScrapSale.find().sort({ createdAt: -1 });
    const totalWasteSold = scrapSales.reduce((sum, sale) => sum + sale.weightSoldKg, 0);

    // 3. Calculate current inventory
    const currentWasteInventory = totalWasteGenerated - totalWasteSold;

    res.json({
      currentWasteInventory,
      totalWasteGenerated,
      totalWasteSold,
      productionWaste,
      scrapSales
    });
  } catch (error) {
    console.error('[WASTE ERROR]', error);
    res.status(500).json({ message: 'Error fetching waste statistics', error: error.message });
  }
};

exports.recordScrapSale = async (req, res) => {
  try {
    const { buyerName, weightSoldKg, ratePerKg } = req.body;

    if (!buyerName || !weightSoldKg || !ratePerKg) {
      return res.status(400).json({ message: 'Missing required sale parameters' });
    }

    const totalAmount = parseFloat(weightSoldKg) * parseFloat(ratePerKg);

    const sale = await ScrapSale.create({
      buyerName,
      weightSoldKg,
      ratePerKg,
      totalAmount,
      recordedBy: req.user._id
    });

    res.status(201).json({ message: 'Scrap sale recorded successfully', sale });
  } catch (error) {
    console.error('[SCRAP SALE ERROR]', error);
    res.status(500).json({ message: 'Error recording scrap sale', error: error.message });
  }
};