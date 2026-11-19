const express = require('express');
const router = express.Router();
const { getWasteStats, recordScrapSale, recordThakEntry } = require('../controllers/waste.controller');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);

router.get('/', getWasteStats);
router.post('/sale', recordScrapSale);
router.post('/thak-entry', recordThakEntry);

module.exports = router;