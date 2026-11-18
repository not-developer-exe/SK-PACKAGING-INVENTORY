const express = require('express');
const router = express.Router();
const { recordDispatch, getAvailableBoxes, getDispatches, cancelDispatch, markDelivered } = require('../controllers/dispatch.controller');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);

router.get('/boxes', getAvailableBoxes);
router.get('/', getDispatches)
router.post('/', recordDispatch);
router.patch('/:id/cancel', cancelDispatch);
router.patch('/:id/delivered', markDelivered);

module.exports = router;

