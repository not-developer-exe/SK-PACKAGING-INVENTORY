const express = require('express');
const router = express.Router();
const { getWasteStats, recordScrapSale } = require('../controllers/waste.controller');
const { protect } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');

router.use(protect, requireRole('admin'));

router.get('/', getWasteStats);
router.post('/sale', recordScrapSale);

module.exports = router;