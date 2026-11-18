const express = require('express');
const router = express.Router();
const { getInvoices, getUninvoicedDispatches, getTaxContext, createInvoice, cancelInvoice } = require('../controllers/invoice.controller');
const { requireRole } = require('../middlewares/role.middleware');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);
router.get('/tax-context', getTaxContext);
router.get('/', getInvoices);
router.get('/uninvoiced/:customerId', getUninvoicedDispatches);
router.post('/', createInvoice);
router.patch('/:id/cancel', requireRole('admin'), cancelInvoice);

module.exports = router;