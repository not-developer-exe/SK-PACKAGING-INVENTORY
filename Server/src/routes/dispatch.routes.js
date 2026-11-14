const express = require('express');
const router = express.Router();
const { recordDispatch, getAvailableBoxes, getDispatches, cancelDispatch } = require('../controllers/dispatch.controller');
const { protect } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');

router.use(protect);

router.get('/boxes', getAvailableBoxes);
router.get('/', getDispatches)
router.post('/', recordDispatch);
router.patch('/:id/cancel', requireRole('admin'), cancelDispatch);

module.exports = router;

