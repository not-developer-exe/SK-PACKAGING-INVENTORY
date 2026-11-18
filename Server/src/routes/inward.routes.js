const express = require('express');
const router = express.Router();
const { createDraftReceipt, getReceipts, postReceipt } = require('../controllers/inward.controller');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);
router.use((req, res, next) => { req.companyKey = 'sk-packaging'; next(); });

router.get('/', getReceipts);
router.post('/', createDraftReceipt);
router.post('/:id/post', postReceipt);

module.exports = router;