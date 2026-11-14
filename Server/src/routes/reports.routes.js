const express = require('express');
const router = express.Router();
const { getProfitLoss } = require('../controllers/profitLoss.controller');
const { getActivityReport } = require('../controllers/activityReport.controller');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);
router.get('/profit-loss', getProfitLoss);
router.get('/activity', getActivityReport);

module.exports = router;
