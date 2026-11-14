const express = require('express');
const router = express.Router();
const { recordConversion, getAvailableSheets, getFinishedGoods } = require('../controllers/conversion.controller');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);

router.get('/sheets', getAvailableSheets);
router.get('/finished-goods', getFinishedGoods);
router.post('/', recordConversion);

module.exports = router;