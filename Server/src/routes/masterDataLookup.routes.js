const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { lookupIfsc, lookupGstin } = require('../controllers/masterDataLookup.controller');
router.use(protect);
router.get('/ifsc/:ifsc', lookupIfsc);
router.get('/gstin/:gstin', lookupGstin);
module.exports = router;
