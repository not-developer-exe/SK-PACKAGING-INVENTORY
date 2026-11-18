const express = require('express');
const router = express.Router();
const { getWasteStats, recordScrapSale } = require('../controllers/waste.controller');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);

router.get('/', getWasteStats);
router.post('/sale', recordScrapSale);

module.exports = router;