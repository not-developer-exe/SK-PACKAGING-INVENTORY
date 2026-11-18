const express = require('express');
const router = express.Router();
const { recordProduction, getProductionRuns } = require('../controllers/production.controller');
const { protect } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');

router.use(protect, requireRole('admin'));
router.get('/', getProductionRuns);
router.post('/', recordProduction);

module.exports = router;