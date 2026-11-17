const Invoice = require('../models/Invoice.model');
const Expense = require('../models/Expense.model');
const Party = require('../models/Party.model');
const ScrapSale = require('../models/ScrapSale.model');
const { buildDateRangeFilter, formatDateOnlyLocal } = require('../utils/dateFilters');

const amount = value => Number(value || 0);
const monthKey = value => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' }).formatToParts(new Date(value));
  const get = type => parts.find(part => part.type === type)?.value || '';
  return get('year') + '-' + get('month');
};
const inRange = (date, from, to) => {
  const value = new Date(date).getTime();
  return Number.isFinite(value) && (!from || value >= from.getTime()) && (!to || value < to.getTime());
};

exports.getFinancialHealth = async (req, res) => {
  try {
    const today = formatDateOnlyLocal(new Date());
    const from = req.query.from || today.slice(0, 7) + '-01';
    const to = req.query.to || today;
    const expenseDateFilter = buildDateRangeFilter(from, to, 'expenseDate');
    const fromDate = new Date(from + 'T00:00:00+05:30');
    const toExclusive = new Date(to + 'T00:00:00+05:30');
    toExclusive.setDate(toExclusive.getDate() + 1);
    const [invoices, expenses, parties, scrapSales] = await Promise.all([
      Invoice.find({ status: { $ne: 'Cancelled' } }).select('invoiceNumber invoiceDate customerId grandTotal balanceDue payments status').populate('customerId', 'name').lean(),
      Expense.find(expenseDateFilter).select('expenseDate amount category costTreatment paymentMode vendor').lean(),
      Party.find({}).select('name type balance ledger isActive').lean(),
      ScrapSale.find(buildDateRangeFilter(from, to, 'saleDate')).select('saleDate totalAmount buyerName').lean()
    ]);

    const outstanding = invoices.filter(invoice => amount(invoice.balanceDue) > 0.005);
    const buckets = [
      { key: '0-30', label: '0–30 days', amount: 0, invoices: 0 },
      { key: '31-60', label: '31–60 days', amount: 0, invoices: 0 },
      { key: '61-90', label: '61–90 days', amount: 0, invoices: 0 },
      { key: '90+', label: 'Over 90 days', amount: 0, invoices: 0 }
    ];
    const customerMap = new Map();
    const now = Date.now();
    for (const invoice of outstanding) {
      const age = Math.max(0, Math.floor((now - new Date(invoice.invoiceDate).getTime()) / 86400000));
      const index = age <= 30 ? 0 : age <= 60 ? 1 : age <= 90 ? 2 : 3;
      buckets[index].amount += amount(invoice.balanceDue);
      buckets[index].invoices += 1;
      const name = invoice.customerId?.name || 'Unknown customer';
      const entry = customerMap.get(name) || { name, amount: 0, invoices: 0 };
      entry.amount += amount(invoice.balanceDue);
      entry.invoices += 1;
      customerMap.set(name, entry);
    }
    const supplierPayables = parties.filter(p => ['Supplier', 'Both'].includes(p.type) && amount(p.balance) < -0.005)
      .map(p => ({ name: p.name, amount: Math.abs(amount(p.balance)) }))
      .sort((a, b) => b.amount - a.amount);
    const customerReceivables = [...customerMap.values()].map(v => ({ ...v, amount: Number(v.amount.toFixed(2)) })).sort((a,b)=>b.amount-a.amount);

    const monthly = new Map();
    const getMonth = date => {
      const key = monthKey(date);
      const row = monthly.get(key) || { month: key, customerCollections: 0, scrapReceipts: 0, expenses: 0, supplierPayments: 0 };
      monthly.set(key, row);
      return row;
    };
    let customerCollections = 0;
    for (const invoice of invoices) for (const payment of invoice.payments || []) {
      if (inRange(payment.date, fromDate, toExclusive)) {
        const value = amount(payment.amount);
        customerCollections += value;
        getMonth(payment.date).customerCollections += value;
      }
    }
    let supplierPayments = 0;
    for (const party of parties) for (const entry of party.ledger || []) {
      if (entry.type === 'Payment Sent' && inRange(entry.date, fromDate, toExclusive)) {
        const value = amount(entry.debit);
        supplierPayments += value;
        getMonth(entry.date).supplierPayments += value;
      }
    }
    let expenseOutflow = 0;
    for (const expense of expenses) {
      if (expense.costTreatment === 'stock_landed_cost') continue;
      const value = amount(expense.amount);
      expenseOutflow += value;
      getMonth(expense.expenseDate).expenses += value;
    }
    let scrapReceipts = 0;
    for (const sale of scrapSales) {
      const value = amount(sale.totalAmount);
      scrapReceipts += value;
      getMonth(sale.saleDate).scrapReceipts += value;
    }
    const cashFlow = [...monthly.values()].sort((a,b)=>a.month.localeCompare(b.month)).map(row => {
      const inflow = row.customerCollections + row.scrapReceipts;
      const outflow = row.expenses + row.supplierPayments;
      return { ...row, inflow: Number(inflow.toFixed(2)), outflow: Number(outflow.toFixed(2)), net: Number((inflow-outflow).toFixed(2)) };
    });
    const totalCashIn = customerCollections + scrapReceipts;
    const totalCashOut = expenseOutflow + supplierPayments;
    return res.json({
      period: { from, to },
      cashFlow: {
        customerCollections: Number(customerCollections.toFixed(2)),
        scrapReceipts: Number(scrapReceipts.toFixed(2)),
        expenses: Number(expenseOutflow.toFixed(2)),
        supplierPayments: Number(supplierPayments.toFixed(2)),
        totalCashIn: Number(totalCashIn.toFixed(2)),
        totalCashOut: Number(totalCashOut.toFixed(2)),
        netCashFlow: Number((totalCashIn-totalCashOut).toFixed(2)),
        monthly: cashFlow
      },
      receivables: {
        total: Number(outstanding.reduce((sum, invoice) => sum + amount(invoice.balanceDue), 0).toFixed(2)),
        invoiceCount: outstanding.length,
        agingBasis: 'Invoice date (not contractual due date)',
        buckets: buckets.map(row => ({ ...row, amount: Number(row.amount.toFixed(2)) })),
        customers: customerReceivables
      },
      payables: {
        total: Number(supplierPayables.reduce((sum, row) => sum + row.amount, 0).toFixed(2)),
        suppliers: supplierPayables
      },
      notes: [
        'Customer collections use payment allocations recorded against invoices, not invoice totals.',
        'Supplier payments use Payment Sent entries in all party ledgers, including archived parties, so historical outflows remain visible.',
        'Supplier payables are based on supplier party-ledger balances. Inward receipts currently post inventory and landed cost but do not create supplier bills automatically; enter/maintain supplier opening and bill balances in the party ledger before relying on payable totals.',
        'Expenses use their recorded expense date as a cash-outflow proxy; the register does not currently store a separate payment date or unpaid expense status.',
        'Stock landed-cost expenses are excluded to avoid double counting freight already capitalized into reel landed cost.',
        'Receivable aging is based on invoice date because contractual due dates are not currently stored.',
        'This is a management cash movement view, not a bank reconciliation or statutory cash-flow statement.'
      ]
    });
  } catch (error) {
    console.error('[FINANCIAL HEALTH] Report failed:', error.message);
    return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Unable to generate financial health report.' });
  }
};
