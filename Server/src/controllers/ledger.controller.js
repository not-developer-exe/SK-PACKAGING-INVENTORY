const StockMovement = require('../models/StockMovement.model');

exports.getLedger = async (req, res) => {
  try {
    // Fetch the 200 most recent movements, newest first, and populate the user who did it
    const movements = await StockMovement.find()
      .populate('performedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(200); 
      
    res.json({ movements });
  } catch (error) {
    console.error('[LEDGER ERROR]', error);
    res.status(500).json({ message: 'Error fetching ledger data', error: error.message });
  }
};