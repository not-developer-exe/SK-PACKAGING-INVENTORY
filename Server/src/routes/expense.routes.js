const express = require('express');
const router = express.Router();
const { listExpenses, createExpense, updateExpense, deleteExpense } = require('../controllers/expense.controller');
const { protect } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');

router.use(protect);
router.get('/', listExpenses);
router.post('/', createExpense);
router.patch('/:id', requireRole('admin'), updateExpense);
router.delete('/:id', requireRole('admin'), deleteExpense);

module.exports = router;
