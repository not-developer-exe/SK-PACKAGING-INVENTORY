const express = require('express');
const router = express.Router();
const { getLedger } = require('../controllers/ledger.controller');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);
router.get('/', getLedger);

module.exports = router;