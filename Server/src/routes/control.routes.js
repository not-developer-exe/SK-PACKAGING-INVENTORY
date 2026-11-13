const express = require('express');
const router = express.Router();
const {
  getOpeningStockAdjustments,
  createOpeningStockAdjustment,
  getAuditLogs
} = require('../controllers/openingStock.controller');
const { protect } = require('../middlewares/auth.middleware');
const { getReconciliationCandidates, getStockReconciliations, postStockReconciliation } = require('../controllers/stockReconciliation.controller');
const { requireRole } = require('../middlewares/role.middleware');

router.use(protect);
router.get('/opening-stock', requireRole('admin'), getOpeningStockAdjustments);
router.post('/opening-stock', requireRole('admin'), createOpeningStockAdjustment);
router.get('/audit', requireRole('admin'), getAuditLogs);
router.get('/stock-reconciliation/candidates', requireRole('admin'), getReconciliationCandidates);
router.get('/stock-reconciliation', requireRole('admin'), getStockReconciliations);
router.post('/stock-reconciliation', requireRole('admin'), postStockReconciliation);

module.exports = router;
