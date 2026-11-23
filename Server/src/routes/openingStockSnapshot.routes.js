const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { getOpeningStockSnapshot } = require('../controllers/openingStockSnapshot.controller');

router.use(protect);
router.get('/', getOpeningStockSnapshot);
module.exports = router;
