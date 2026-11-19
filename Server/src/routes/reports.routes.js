const express = require('express');
const router = express.Router();
const { getProfitLoss } = require('../controllers/profitLoss.controller');
const { getActivityReport } = require('../controllers/activityReport.controller');
const { getFinancialHealth } = require('../controllers/financialHealth.controller');
const { getInventoryValuation } = require('../controllers/inventoryValuation.controller');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);
router.get('/profit-loss', getProfitLoss);
router.get('/activity', getActivityReport);
router.get('/financial-health', getFinancialHealth);
router.get('/inventory-valuation', getInventoryValuation);

module.exports = router;
