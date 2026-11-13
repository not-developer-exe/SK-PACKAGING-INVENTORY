const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { createInvoice, getInvoices, getUninvoicedDispatches } = require('../controllers/invoice.controller');

router.use(protect);
router.post('/', createInvoice);
router.get('/', getInvoices);
router.get('/uninvoiced/:customerId', getUninvoicedDispatches);

module.exports = router;