const express = require('express');
const router = express.Router();
const { recordProduction, getProductionRuns } = require('../controllers/production.controller');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);
router.get('/', getProductionRuns);
router.post('/', recordProduction);

module.exports = router;