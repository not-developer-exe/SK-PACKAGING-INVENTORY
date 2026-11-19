const mongoose = require('mongoose');
const FinancialAccount = require('../models/FinancialAccount.model');
const FinancialTransaction = require('../models/FinancialTransaction.model');
const writeAuditLog = require('../utils/writeAuditLog');
const VALID_COMPANIES = ['sk-packaging', 'nsb-industrial-solutions'];
const companyKey = (req) => VALID_COMPANIES.includes(req.companyKey) ? req.companyKey : 'sk-packaging';
const dateOnly = (value) => { if (typeof value !== 'string' || !/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) return false; const [year, month, day] = value.split('-').map(Number); const check = new Date(Date.UTC(year, month - 1, day)); return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day; };
const money = (value) => Number(Number(value).toFixed(2));

async function accountBalances(key) {
  return FinancialAccount.find({ companyKey: key }).sort({ type: 1, name: 1 }).lean().then((accounts) =>
    accounts.map((account) => ({ ...account, balance: money(account.currentBalance ?? account.openingBalance) }))
  );
}

exports.listAccounts = async (req, res) => {
  try {
    const accounts = await accountBalances(companyKey(req));
    res.json({ accounts, totalBalance: money(accounts.reduce((sum, account) => sum + account.balance, 0)) });
  } catch (error) { console.error('[FINANCE] Accounts:', error); res.status(500).json({ message: 'Unable to load financial accounts.' }); }
};

exports.createAccount = async (req, res) => {
  const body = req.body || {};
  const type = body.type;
  const openingBalance = Number(body.openingBalance || 0);
  if (!['bank', 'cash'].includes(type) || !body.name?.trim() || !Number.isFinite(openingBalance) || openingBalance < 0) return res.status(400).json({ message: 'Enter a valid account name, type and opening balance.' });
  if (type === 'bank' && (!body.bankName?.trim() || !body.accountNumber?.trim() || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(String(body.ifsc || '').toUpperCase()))) return res.status(400).json({ message: 'For bank accounts, enter bank name, account number and a valid IFSC.' });
  try {
    const key = companyKey(req);
    if (body.isDefaultForInvoice && type !== 'bank') return res.status(400).json({ message: 'Only a bank account can be selected for invoices.' });
    const account = await FinancialAccount.create({
      companyKey: key, name: body.name.trim(), type, openingBalance: money(openingBalance), currentBalance: money(openingBalance),
      bankName: body.bankName || '', accountHolder: body.accountHolder || '', accountNumber: body.accountNumber || '',
      ifsc: String(body.ifsc || '').toUpperCase(), branch: body.branch || '', branchAddress: body.branchAddress || '', bankCity: body.bankCity || '', bankState: body.bankState || '', upiId: body.upiId || '',
      isDefaultForInvoice: Boolean(body.isDefaultForInvoice), createdBy: req.user._id
    });
    if (account.isDefaultForInvoice) await FinancialAccount.updateMany({ companyKey: key, _id: { $ne: account._id } }, { $set: { isDefaultForInvoice: false } });
    await writeAuditLog(req, { action: 'finance.account.created', entityType: 'FinancialAccount', entityId: account._id, entityLabel: account.name, summary: 'Financial account created: ' + account.name }, null);
    res.status(201).json({ account });
  } catch (error) { res.status(error.code === 11000 ? 409 : 400).json({ message: error.code === 11000 ? 'An account with this name already exists.' : 'Unable to create account.' }); }
};

exports.createTransaction = async (req, res) => {
  const body = req.body || {};
  const amount = Number(body.amount);
  if (!dateOnly(body.date) || !['income', 'expense', 'transfer'].includes(body.kind) || !Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: 'Enter a valid date, transaction type and amount.' });
  if (body.kind === 'income' && !mongoose.isValidObjectId(body.toAccountId)) return res.status(400).json({ message: 'Select the account receiving the money.' });
  if (body.kind === 'expense' && !mongoose.isValidObjectId(body.fromAccountId)) return res.status(400).json({ message: 'Select the account paying the money.' });
  if (body.kind === 'transfer' && (!mongoose.isValidObjectId(body.fromAccountId) || !mongoose.isValidObjectId(body.toAccountId) || String(body.fromAccountId) === String(body.toAccountId))) return res.status(400).json({ message: 'Select two different source and destination accounts.' });
  const session = await mongoose.startSession();
  try {
    let transaction;
    await session.withTransaction(async () => {
      const key = companyKey(req);
      const ids = [body.fromAccountId, body.toAccountId].filter(Boolean);
      const accounts = await FinancialAccount.find({ _id: { $in: ids }, companyKey: key, isActive: true }).session(session);
      if (accounts.length !== ids.length) throw Object.assign(new Error('One of the selected accounts is unavailable in this company.'), { statusCode: 422 });
      if (body.kind === 'income') {
        await FinancialAccount.updateOne({ _id: body.toAccountId, companyKey: key, isActive: true }, { $inc: { currentBalance: money(amount) } }, { session });
      } else {
        const debited = await FinancialAccount.updateOne(
          { _id: body.fromAccountId, companyKey: key, isActive: true, currentBalance: { $gte: money(amount) } },
          { $inc: { currentBalance: -money(amount) } }, { session }
        );
        if (!debited.modifiedCount) throw Object.assign(new Error('Insufficient balance in the selected source account.'), { statusCode: 422 });
        if (body.kind === 'transfer') {
          await FinancialAccount.updateOne({ _id: body.toAccountId, companyKey: key, isActive: true }, { $inc: { currentBalance: money(amount) } }, { session });
        }
      }
      [transaction] = await FinancialTransaction.create([{
        companyKey: key, date: new Date(body.date + 'T00:00:00+05:30'), kind: body.kind, amount: money(amount),
        fromAccountId: body.kind === 'income' ? null : body.fromAccountId || null,
        toAccountId: body.kind === 'expense' ? null : body.toAccountId || null,
        category: body.category || '', party: body.party || '', description: body.description || '',
        reference: body.reference || '', createdBy: req.user._id
      }], { session });
      await writeAuditLog(req, { action: 'finance.transaction.created', entityType: 'FinancialTransaction', entityId: transaction._id, entityLabel: transaction.kind, summary: transaction.kind + ' transaction recorded: ₹' + transaction.amount, metadata: { amount: transaction.amount, kind: transaction.kind, fromAccountId: transaction.fromAccountId, toAccountId: transaction.toAccountId } }, session);
    });
    res.status(201).json({ transaction });
  } catch (error) { res.status(error.statusCode || 400).json({ message: error.message || 'Unable to record transaction.' }); }
  finally { await session.endSession(); }
};

exports.listTransactions = async (req, res) => {
  try {
    const filter = { companyKey: companyKey(req) };
    if (req.query.from || req.query.to) {
      filter.date = {};
      if (dateOnly(req.query.from)) filter.date.$gte = new Date(req.query.from + 'T00:00:00+05:30');
      if (dateOnly(req.query.to)) filter.date.$lte = new Date(req.query.to + 'T23:59:59+05:30');
    }
    const transactions = await FinancialTransaction.find(filter).populate('fromAccountId', 'name type').populate('toAccountId', 'name type').populate('createdBy', 'name').sort({ date: -1, createdAt: -1 }).limit(1000).lean();
    res.json({ transactions });
  } catch (error) { res.status(500).json({ message: 'Unable to load transactions.' }); }
};

exports.getInvoiceBankDetails = async (req, res) => {
  try {
    const account = await FinancialAccount.findOne({ companyKey: companyKey(req), type: 'bank', isActive: true, isDefaultForInvoice: true }).lean();
    res.json({ bankDetails: account ? { bankName: account.bankName, accountHolder: account.accountHolder, accountNumber: account.accountNumber, ifsc: account.ifsc, branch: account.branch, branchAddress: account.branchAddress, bankCity: account.bankCity, bankState: account.bankState, upiId: account.upiId } : null });
  } catch (error) { res.status(500).json({ message: 'Unable to load invoice bank details.' }); }
};
