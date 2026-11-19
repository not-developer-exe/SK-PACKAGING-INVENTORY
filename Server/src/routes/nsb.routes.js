const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { useCompany } = require('../middlewares/companyScope.middleware');
const { requireRole } = require('../middlewares/role.middleware');
const { listExpenses, createExpense, updateExpense, deleteExpense } = require('../controllers/expense.controller');
const partyRoutes = require('./party.routes');
const invoiceRoutes = require('./invoice.routes');
const financeRoutes = require('./finance.routes');
const masterDataLookupRoutes = require('./masterDataLookup.routes');

// NSB is a separate owner-only workspace. It never falls back to S.K Packaging records.
router.use(protect, requireRole('admin'), useCompany('nsb-industrial-solutions'));
router.use('/parties', partyRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/finance', financeRoutes);
router.use('/lookups', masterDataLookupRoutes);
router.get('/expenses', listExpenses);
router.post('/expenses', createExpense);
router.patch('/expenses/:id', updateExpense);
router.delete('/expenses/:id', deleteExpense);
module.exports = router;
