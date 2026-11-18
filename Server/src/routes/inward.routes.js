const express = require('express');
const router = express.Router();
const { createDraftReceipt, getReceipts, postReceipt } = require('../controllers/inward.controller');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);

router.get('/', getReceipts);
router.post('/', createDraftReceipt);
router.post('/:id/post', postReceipt);

module.exports = router;