const StockMovement = require('../models/StockMovement.model');
const { buildDateRangeFilter } = require('../utils/dateFilters');

exports.getLedger = async (req, res) => {
  try {
    const filter = buildDateRangeFilter(req.query.from, req.query.to, 'createdAt');
    if (req.query.movementType) {
      const allowed = ['inward_receipt', 'production_issue', 'sheet_cutting', 'adjustment', 'dispatch'];
      if (!allowed.includes(req.query.movementType)) return res.status(400).json({ message: 'Invalid movement type.' });
      filter.movementType = req.query.movementType;
    }
    if (req.query.itemType) {
      if (!['reel', 'sheet', 'finished_good'].includes(req.query.itemType)) return res.status(400).json({ message: 'Invalid item type.' });
      filter.itemType = req.query.itemType;
    }
    const movements = await StockMovement.find(filter)
      .populate('performedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(1000); 
      
    res.json({ movements });
  } catch (error) {
    console.error('[LEDGER ERROR]', error);
    res.status(500).json({ message: 'Error fetching ledger data', error: error.message });
  }
};