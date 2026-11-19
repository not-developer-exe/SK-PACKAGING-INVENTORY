const round = (value) => Number(Number(value || 0).toFixed(2));

function reconcileSalesDispatch({ dispatches = [], invoices = [], parties = [] }) {
  const invoiceByDispatch = new Map(invoices.map((invoice) => [String(invoice.dispatchId), invoice]));
  const partyById = new Map(parties.map((party) => [String(party._id), party]));
  const rows = [];
  const totals = {
    dispatchCount: dispatches.length, invoicedDispatches: 0, uninvoicedDispatches: 0,
    cancelledDispatches: 0, deliveredDispatches: 0, dispatchedBoxes: 0,
    invoiceCount: 0, taxableSales: 0, gst: 0, invoiceTotal: 0,
    recordedPayments: 0, outstanding: 0, costedInvoices: 0, uncostedInvoices: 0,
    costOfGoods: 0, grossProfit: 0
  };

  for (const dispatch of dispatches) {
    if (dispatch.status === 'cancelled') totals.cancelledDispatches += 1;
    if (dispatch.status === 'delivered') totals.deliveredDispatches += 1;
    const boxes = dispatch.status === 'cancelled' ? 0 : (dispatch.boxes || []).reduce((sum, line) => sum + Number(line.dispatchQuantity || 0), 0);
    totals.dispatchedBoxes += boxes;
    const invoice = invoiceByDispatch.get(String(dispatch._id));
    const issues = [];
    if (dispatch.status === 'cancelled' && invoice && invoice.status !== 'Cancelled') {
      issues.push('Cancelled dispatch still has an active invoice');
    }
    if (!invoice || invoice.status === 'Cancelled') {
      if (dispatch.status !== 'cancelled') {
        totals.uninvoicedDispatches += 1;
        issues.push(invoice ? 'Linked invoice is cancelled' : 'No invoice linked');
      }
      rows.push({
        dispatchId: String(dispatch._id), challanNumber: dispatch.challanNumber,
        dispatchDate: dispatch.dispatchDate, customer: dispatch.customerId?.name || 'Unknown customer',
        dispatchStatus: dispatch.status, dispatchedBoxes: boxes, invoiceNumber: invoice?.invoiceNumber || null,
        invoiceStatus: invoice?.status || null, invoiceDate: invoice?.invoiceDate || null,
        taxableSales: 0, gst: 0, invoiceTotal: 0, payments: 0, outstanding: 0,
        costingStatus: 'not_invoiced', costOfGoods: null, grossProfit: null, issues
      });
      continue;
    }

    totals.invoicedDispatches += 1;
    totals.invoiceCount += 1;
    const lineQty = new Map();
    for (const line of invoice.items || []) {
      const key = String(line.boxId);
      lineQty.set(key, (lineQty.get(key) || 0) + Number(line.quantity || 0));
    }
    const dispatchQty = new Map();
    for (const line of dispatch.boxes || []) {
      const key = String(line.boxId);
      dispatchQty.set(key, (dispatchQty.get(key) || 0) + Number(line.dispatchQuantity || 0));
    }
    const ids = new Set([...lineQty.keys(), ...dispatchQty.keys()]);
    for (const id of ids) {
      if ((lineQty.get(id) || 0) !== (dispatchQty.get(id) || 0)) {
        issues.push('Invoice quantities do not match dispatch quantities');
        break;
      }
    }
    const calculatedTaxable = round((invoice.items || []).reduce((sum, line) => sum + Number(line.taxableAmount ?? Number(line.quantity || 0) * Number(line.rate || 0)), 0));
    const recordedTax = round(Number(invoice.cgstAmount || 0) + Number(invoice.sgstAmount || 0) + Number(invoice.igstAmount || 0));
    const calculatedGrand = round(Number(invoice.subTotal || 0) + recordedTax);
    if (Math.abs(calculatedTaxable - Number(invoice.subTotal || 0)) > 0.02) issues.push('Invoice line totals do not match subtotal');
    if (Math.abs(calculatedGrand - Number(invoice.grandTotal || 0)) > 0.02) issues.push('Invoice total does not reconcile to subtotal plus GST');
    const payments = round((invoice.payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
    const expectedBalance = round(Number(invoice.grandTotal || 0) - payments);
    if (Math.abs(expectedBalance - Number(invoice.balanceDue || 0)) > 0.02) issues.push('Payment total does not reconcile to invoice balance');
    const party = partyById.get(String(invoice.customerId?._id || invoice.customerId));
    const ledgerEntry = party?.ledger?.find((entry) => entry.type === 'Tax Invoice' && entry.ref === invoice.invoiceNumber);
    if (!ledgerEntry && invoice.status !== 'Cancelled') issues.push('Customer ledger invoice debit not found');
    else if (ledgerEntry && Math.abs(Number(ledgerEntry.debit || 0) - Number(invoice.grandTotal || 0)) > 0.02) issues.push('Customer ledger debit differs from invoice total');
    if (ledgerEntry && (invoice.payments || []).length) {
      const allocatedPayments = round((party?.ledger || []).reduce((sum, entry) => {
        const allocation = (entry.allocations || []).find((item) => String(item.billEntryId) === String(ledgerEntry._id));
        return sum + Number(allocation?.amount || 0);
      }, 0));
      if (Math.abs(allocatedPayments - payments) > 0.02) issues.push('Invoice payments differ from customer-ledger allocations');
    }
    if (String(dispatch.customerId?._id || dispatch.customerId) !== String(invoice.customerId?._id || invoice.customerId)) issues.push('Dispatch and invoice customer differ');

    const costed = invoice.costingStatus === 'available' && invoice.costOfGoods !== null && invoice.costOfGoods !== undefined;
    if (costed) {
      totals.costedInvoices += 1;
      totals.costOfGoods += Number(invoice.costOfGoods || 0);
      totals.grossProfit += Number(invoice.grossProfit || 0);
    } else totals.uncostedInvoices += 1;
    totals.taxableSales += Number(invoice.subTotal || 0);
    totals.gst += recordedTax;
    totals.invoiceTotal += Number(invoice.grandTotal || 0);
    totals.recordedPayments += payments;
    totals.outstanding += Number(invoice.balanceDue || 0);
    rows.push({
      dispatchId: String(dispatch._id), challanNumber: dispatch.challanNumber,
      dispatchDate: dispatch.dispatchDate, customer: dispatch.customerId?.name || 'Unknown customer',
      dispatchStatus: dispatch.status, dispatchedBoxes: boxes, invoiceNumber: invoice.invoiceNumber,
      invoiceStatus: invoice.status, invoiceDate: invoice.invoiceDate,
      taxableSales: round(invoice.subTotal), gst: recordedTax, invoiceTotal: round(invoice.grandTotal),
      payments, outstanding: round(invoice.balanceDue), costingStatus: costed ? 'available' : 'pending',
      costOfGoods: costed ? round(invoice.costOfGoods) : null,
      grossProfit: costed ? round(invoice.grossProfit) : null, issues
    });
  }

  for (const key of ['taxableSales', 'gst', 'invoiceTotal', 'recordedPayments', 'outstanding', 'costOfGoods', 'grossProfit']) totals[key] = round(totals[key]);
  totals.grossProfitCoveragePercent = totals.invoiceCount
    ? Number((totals.costedInvoices / totals.invoiceCount * 100).toFixed(1)) : 100;
  return { totals, rows, exceptionCount: rows.filter((row) => row.issues.length).length };
}

module.exports = { reconcileSalesDispatch };
