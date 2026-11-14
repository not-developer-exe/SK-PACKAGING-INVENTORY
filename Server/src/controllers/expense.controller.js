const mongoose = require('mongoose');
const Expense = require('../models/Expense.model');
const writeAuditLog = require('../utils/writeAuditLog');
const { isValidDateOnly, buildDateRangeFilter } = require('../utils/dateFilters');

const categories = ['electricity', 'labour', 'rent', 'freight', 'repairs', 'admin', 'bank_charges', 'interest', 'miscellaneous'];
const treatments = ['operating_expense', 'finance_cost', 'stock_landed_cost'];
const modes = ['cash', 'upi', 'bank_transfer', 'cheque', 'card', 'other'];

function validateExpense(body, partial = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Invalid expense data.';
  if (!partial || body.expenseDate !== undefined) {
    if (!isValidDateOnly(body.expenseDate)) return 'Enter a real calendar date in YYYY-MM-DD format.';
  }
  if (!partial || body.category !== undefined) if (!categories.includes(body.category)) return 'Choose a valid expense category.';
  if (!partial || body.amount !== undefined) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) return 'Amount must be greater than zero.';
  }
  if (!partial || body.paymentMode !== undefined) if (!modes.includes(body.paymentMode)) return 'Choose a valid payment mode.';
  if (body.costTreatment !== undefined && !treatments.includes(body.costTreatment)) return 'Choose a valid cost treatment.';
  for (const key of ['vendor', 'reference', 'description']) {
    if (body[key] !== undefined && (typeof body[key] !== 'string' || body[key].length > (key === 'description' ? 1000 : 160))) return 'Invalid ' + key + '.';
  }
  return null;
}

exports.listExpenses = async (req, res) => {
  try {
    const filter = buildDateRangeFilter(req.query.from, req.query.to, 'expenseDate');
    const expenses = await Expense.find(filter).populate('recordedBy', 'name').sort({ expenseDate: -1, createdAt: -1 }).limit(1000).lean();
    return res.json({ expenses });
  } catch (error) {
    console.error('[EXPENSES] List failed:', error.message);
    return res.status(500).json({ message: 'Unable to load expenses.' });
  }
};

exports.createExpense = async (req, res) => {
  const validationError = validateExpense(req.body);
  if (validationError) return res.status(400).json({ message: validationError });
  const session = await mongoose.startSession();
  try {
    let created;
    await session.withTransaction(async () => {
      [created] = await Expense.create([{
        expenseDate: req.body.expenseDate,
        category: req.body.category,
        amount: Number(Number(req.body.amount).toFixed(2)),
        vendor: req.body.vendor || '',
        paymentMode: req.body.paymentMode,
        reference: req.body.reference || '',
        description: req.body.description || '',
        costTreatment: req.body.costTreatment || 'operating_expense',
        recordedBy: req.user._id
      }], { session });
      await writeAuditLog(req, { action: 'expense.created', entityType: 'Expense', entityId: created._id, entityLabel: created.category, summary: 'Expense recorded: ₹' + created.amount, metadata: { amount: created.amount, category: created.category, costTreatment: created.costTreatment } }, session);
    });
    return res.status(201).json({ expense: created });
  } catch (error) {
    console.error('[EXPENSES] Create failed:', error.message);
    return res.status(400).json({ message: 'Unable to record expense.' });
  } finally {
    await session.endSession();
  }
};

exports.updateExpense = async (req, res) => {
  const validationError = validateExpense(req.body, true);
  if (validationError) return res.status(400).json({ message: validationError });
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid expense ID.' });
  const session = await mongoose.startSession();
  try {
    let updated;
    await session.withTransaction(async () => {
      const expense = await Expense.findById(req.params.id).session(session);
      if (!expense) throw Object.assign(new Error('Expense not found.'), { statusCode: 404 });
      const before = expense.toObject();
      for (const key of ['expenseDate', 'category', 'amount', 'vendor', 'paymentMode', 'reference', 'description', 'costTreatment']) {
        if (req.body[key] !== undefined) expense[key] = key === 'amount' ? Number(Number(req.body[key]).toFixed(2)) : req.body[key];
      }
      await expense.save({ session });
      await writeAuditLog(req, {
        action: 'expense.updated', entityType: 'Expense', entityId: expense._id,
        entityLabel: expense.category, summary: 'Expense updated: ' + expense._id,
        metadata: {
          before: { expenseDate: before.expenseDate, category: before.category, amount: before.amount, vendor: before.vendor, paymentMode: before.paymentMode, costTreatment: before.costTreatment },
          after: { expenseDate: expense.expenseDate, category: expense.category, amount: expense.amount, vendor: expense.vendor, paymentMode: expense.paymentMode, costTreatment: expense.costTreatment }
        }
      }, session);
      updated = expense;
    });
    return res.json({ expense: updated });
  } catch (error) {
    console.error('[EXPENSES] Update failed:', error.message);
    return res.status(error.statusCode || 400).json({ message: error.message || 'Unable to update expense.' });
  } finally {
    await session.endSession();
  }
};

exports.deleteExpense = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid expense ID.' });
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const expense = await Expense.findById(req.params.id).session(session);
      if (!expense) throw Object.assign(new Error('Expense not found.'), { statusCode: 404 });
      await writeAuditLog(req, { action: 'expense.deleted', entityType: 'Expense', entityId: expense._id, entityLabel: expense.category, summary: 'Expense deleted: ₹' + expense.amount, metadata: { expense: expense.toObject() } }, session);
      await expense.deleteOne({ session });
    });
    return res.json({ message: 'Expense deleted.' });
  } catch (error) {
    console.error('[EXPENSES] Delete failed:', error.message);
    return res.status(error.statusCode || 500).json({ message: error.message || 'Unable to delete expense.' });
  } finally {
    await session.endSession();
  }
};
