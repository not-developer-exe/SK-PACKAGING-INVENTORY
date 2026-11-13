const express = require('express');
const router = express.Router();
const {
  getOpeningStockAdjustments,
  createOpeningStockAdjustment,
  getAuditLogs
} = require('../controllers/openingStock.controller');
const { protect } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');

router.use(protect);
router.get('/opening-stock', requireRole('admin'), getOpeningStockAdjustments);
router.post('/opening-stock', requireRole('admin'), createOpeningStockAdjustment);
router.get('/audit', requireRole('admin'), getAuditLogs);

module.exports = router;
