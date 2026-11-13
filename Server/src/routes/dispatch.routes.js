const express = require('express');
const router = express.Router();
const { recordDispatch, getAvailableBoxes,getDispatches } = require('../controllers/dispatch.controller');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);

router.get('/boxes', getAvailableBoxes);
router.get('/', getDispatches)
router.post('/', recordDispatch);

module.exports = router;

