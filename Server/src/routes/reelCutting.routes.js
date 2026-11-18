const express = require('express');
const router = express.Router();
const { getCuttingRegister, recordCutting } = require('../controllers/reelCutting.controller');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);
router.get('/', getCuttingRegister);
router.post('/', recordCutting);
module.exports = router;
