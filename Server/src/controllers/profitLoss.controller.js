const Invoice = require('../models/Invoice.model');
const ScrapSale = require('../models/ScrapSale.model');
const ProductionRun = require('../models/ProductionRun.model');
const Expense = require('../models/Expense.model');

const { buildProfitLossGroups, isValidDateOnly } = require('../utils/profitLossAggregation');
const { formatDateOnlyLocal } = require('../utils/dateFilters');

exports.getProfitLoss = async (req, res) => {
  try {
    const today = formatDateOnlyLocal(new Date());
    const defaultFrom = today.slice(0, 7) + '-01';
    const from = req.query.from || defaultFrom;
    const to = req.query.to || today;
    if (!isValidDateOnly(from) || !isValidDateOnly(to)) {
      return res.status(400).json({ message: 'Use YYYY-MM-DD for report dates.' });
    }
    if (req.query.partyId) {
      return res.status(400).json({ message: 'This is a company-wide P&L. Use the Party-wise breakdown to review individual customers.' });
    }
    const fromDate = new Date(from + 'T00:00:00+05:30');
    const toDate = new Date(to + 'T00:00:00+05:30');
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || fromDate > toDate) {
      return res.status(400).json({ message: 'Report start date must be on or before end date.' });
    }
    toDate.setDate(toDate.getDate() + 1);

    const invoiceFilter = {
      invoiceDate: { $gte: fromDate, $lt: toDate },
      status: { $ne: 'Cancelled' }
    };

    const [invoices, scrapSales, thakSales, productionRuns, expenses] = await Promise.all([
      Invoice.find(invoiceFilter)
        .populate('customerId', 'name')
        .select('invoiceNumber invoiceDate customerId subTotal costOfGoods grossProfit costingStatus balanceDue status')
        .sort({ invoiceDate: 1 })
        .lean(),
      ScrapSale.find({ saleDate: { $gte: fromDate, $lt: toDate }, saleType: { $ne: 'thak' } }).sort({ saleDate: 1 }).lean(),
      ScrapSale.find({ saleDate: { $gte: fromDate, $lt: toDate }, saleType: 'thak' }).sort({ saleDate: 1 }).lean(),
      ProductionRun.find({ runDate: { $gte: fromDate, $lt: toDate } })
        .select('runDate')
        .lean(),
      Expense.find({ expenseDate: { $gte: fromDate, $lt: toDate } }).sort({ expenseDate: 1 }).lean(),
    ]);

    const costedInvoices = invoices.filter((invoice) =>
      invoice.costingStatus === 'available' && Number.isFinite(Number(invoice.costOfGoods))
    );
    const uncostedInvoices = invoices.length - costedInvoices.length;
    const revenue = Number(invoices.reduce((sum, invoice) => sum + Number(invoice.subTotal || 0), 0).toFixed(2));
    const costOfGoods = Number(costedInvoices.reduce((sum, invoice) => sum + Number(invoice.costOfGoods || 0), 0).toFixed(2));
    const grossProfit = Number(costedInvoices.reduce((sum, invoice) => sum + Number(invoice.grossProfit || 0), 0).toFixed(2));
    const balanceDue = Number(invoices.reduce((sum, invoice) => sum + Number(invoice.balanceDue || 0), 0).toFixed(2));
    const scrapRevenue = Number(scrapSales.reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0).toFixed(2));
    const thakRevenue = Number(thakSales.reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0).toFixed(2));
    const additionalSalesIncome = Number((scrapRevenue + thakRevenue).toFixed(2));
    const operatingExpenses = Number(expenses.filter((item) => item.costTreatment === 'operating_expense').reduce((sum, item) => sum + Number(item.amount || 0), 0).toFixed(2));
    const financeCosts = Number(expenses.filter((item) => item.costTreatment === 'finance_cost').reduce((sum, item) => sum + Number(item.amount || 0), 0).toFixed(2));
    const stockLandedCosts = Number(expenses.filter((item) => item.costTreatment === 'stock_landed_cost').reduce((sum, item) => sum + Number(item.amount || 0), 0).toFixed(2));
    const operatingProfit = Number((grossProfit + additionalSalesIncome - operatingExpenses).toFixed(2));
    const netProfitBeforeTax = Number((operatingProfit - financeCosts).toFixed(2));
    const expenseByCategory = Object.values(expenses.reduce((groups, item) => {
      const costTreatment = item.costTreatment || 'operating_expense';
      const key = item.category + ':' + costTreatment;
      if (!groups[key]) groups[key] = { category: item.category, amount: 0, count: 0, costTreatment };
      groups[key].amount += Number(item.amount || 0);
      groups[key].count += 1;
      return groups;
    }, {})).map((item) => ({ ...item, amount: Number(item.amount.toFixed(2)) }));
    const scrapWeightKg = Number(scrapSales.reduce((sum, sale) => sum + Number(sale.weightSoldKg || 0), 0).toFixed(3));
    const thakWeightKg = Number(thakSales.reduce((sum, sale) => sum + Number(sale.weightSoldKg || 0), 0).toFixed(3));

    const { daily, monthly, partyWise } = buildProfitLossGroups(invoices, productionRuns, scrapSales, expenses, thakSales);

    return res.json({
      period: { from, to },
      summary: {
        invoiceCount: invoices.length,
        revenue,
        costOfGoods,
        grossProfit,
        balanceDue,
        scrapRevenue,
        thakRevenue,
        additionalSalesIncome,
        operatingExpenses,
        financeCosts,
        stockLandedCosts,
        operatingProfit,
        netProfitBeforeTax,
        expenseCount: expenses.length,
        operatingExpenseCount: expenses.filter((item) => item.costTreatment === 'operating_expense').length,
        financeCostCount: expenses.filter((item) => item.costTreatment === 'finance_cost').length,
        stockLandedCostCount: expenses.filter((item) => item.costTreatment === 'stock_landed_cost').length,
        scrapWeightKg,
        thakWeightKg,
        costedInvoiceCount: costedInvoices.length,
        uncostedInvoiceCount: uncostedInvoices,
        grossProfitCoveragePercent: invoices.length ? Number((costedInvoices.length / invoices.length * 100).toFixed(1)) : 100
      },
      daily,
      monthly,
      partyWise,
      expenseByCategory,
      notes: [
        'Sales revenue is shown excluding GST.',
        'Cost of goods sold currently captures raw-material cost: reel landed cost is allocated to produced sheets by output weight, then to finished boxes by consumed sheet weight.',
        'Factory conversion overheads such as labour, power and rent are recorded as period operating expenses, not allocated into unsold finished-goods inventory.',
        'Invoices without a recorded manufacturing cost are excluded from gross-profit totals and counted as uncosted.',
        'Normal scrap and Thak sale proceeds are tracked separately and added to material gross profit as additional sales income.',
        'Production trim, machine-stage waste and process-loss estimates are operational records only; they are not deducted from profit. Thak is entered and weighed separately, and only its actual sale proceeds affect profit.',
        'Operating profit = costed material gross profit + normal scrap sale proceeds + Thak sale proceeds - recorded operating expenses. Finance costs are then deducted to show net profit before tax.',
        'This is an operational management report, not a statutory financial statement; depreciation, income-tax provisions and required inventory overhead adjustments are not included.',
        'Invoices without cost snapshots remain excluded from gross profit and operating profit; review costing coverage before relying on the result.',
        'Expenses marked stock landed cost are excluded from expense totals because eligible inbound freight should already be capitalized into reel landed cost.'
      ]
    });
  } catch (error) {
    console.error('[PROFIT LOSS] Report failed:', error.message);
    return res.status(500).json({ message: 'Unable to generate profit and loss report.' });
  }
};
