const express = require('express');
const router = express.Router();
const { recordProduction } = require('../controllers/production.controller');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);
router.post('/', recordProduction);

module.exports = router;