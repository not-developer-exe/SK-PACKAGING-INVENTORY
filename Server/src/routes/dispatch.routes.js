const express = require('express');
const router = express.Router();
const { recordDispatch, getAvailableBoxes, getDispatches, cancelDispatch, markDelivered, updateFinishedGoodsQuality } = require('../controllers/dispatch.controller');
const { protect } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');

router.use(protect);

router.get('/boxes', getAvailableBoxes);
router.patch('/finished-goods/:id/quality', requireRole('admin'), updateFinishedGoodsQuality);
router.get('/', getDispatches)
router.post('/', recordDispatch);
router.patch('/:id/cancel', requireRole('admin'), cancelDispatch);
router.patch('/:id/delivered', requireRole('admin'), markDelivered);

module.exports = router;

