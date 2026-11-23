const OpeningStockSnapshot = require('../models/OpeningStockSnapshot.model');

exports.getOpeningStockSnapshot = async (req, res) => {
  try {
    const companyKey = req.query.company === 'nsb' ? 'nsb-industrial-solutions' : 'sk-packaging';
    const requestedDate = req.query.date || '2026-11-01';
    if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(requestedDate)) {
      return res.status(400).json({ message: 'Invalid stock date. Use YYYY-MM-DD.' });
    }

    // Match the ISO date string stored by the opening workbook import.
    const stockDate = requestedDate + 'T00:00:00.000Z';
    const records = await OpeningStockSnapshot.find({ companyKey, stockDate }).sort({ categoryLabel: 1 }).lean();
    const totals = records.reduce((acc, item) => {
      acc.totalAmount += Number(item.totalAmount || 0);
      acc.totalWeightKg += Number(item.totalWeightKg || 0);
      acc.categories += 1;
      return acc;
    }, { totalAmount: 0, totalWeightKg: 0, categories: 0 });
    return res.json({ stockDate, companyKey, records, totals });
  } catch (error) {
    console.error('[OPENING STOCK SNAPSHOT]', error);
    return res.status(500).json({ message: 'Unable to load opening stock snapshot.' });
  }
};
