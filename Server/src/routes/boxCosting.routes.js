const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');
const { getSnapshot, getPaperRates, getReelStock } = require('../controllers/boxCosting.controller');

// Owner-only, read-only integration endpoints. No mutations are exposed here.
router.use(protect, requireRole('admin'));
router.get('/snapshot', getSnapshot);
router.get('/paper-rates', getPaperRates);
router.get('/reel-stock', getReelStock);

module.exports = router;
