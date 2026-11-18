const express = require('express');
const router = express.Router();
const { createDraftReceipt, getReceipts, postReceipt } = require('../controllers/inward.controller');
const { protect } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');

router.use(protect, requireRole('admin'));

router.get('/', getReceipts);
router.post('/', createDraftReceipt);
router.post('/:id/post', postReceipt);

module.exports = router;