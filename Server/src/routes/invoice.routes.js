const express = require('express');
const router = express.Router();
const { getUninvoicedDispatches, createInvoice } = require('../controllers/invoice.controller');

router.get('/uninvoiced/:customerId', getUninvoicedDispatches);
router.post('/', createInvoice);

module.exports = router;