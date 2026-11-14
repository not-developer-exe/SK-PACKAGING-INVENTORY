function allocateInvoicePayment(paymentAmount, invoices) {
  const amount = Number(paymentAmount);
  if (!Number.isFinite(amount) || amount <= 0 || !Array.isArray(invoices)) {
    throw new TypeError('Payment amount and invoice list are invalid.');
  }
  let remaining = Number(amount.toFixed(2));
  const allocations = [];
  for (const invoice of invoices) {
    if (remaining <= 0) break;
    const balanceDue = Number(invoice.balanceDue);
    if (!Number.isFinite(balanceDue) || balanceDue <= 0) continue;
    const allocated = Number(Math.min(remaining, balanceDue).toFixed(2));
    if (allocated <= 0) continue;
    allocations.push({ invoiceId: String(invoice.invoiceId), amount: allocated });
    remaining = Number((remaining - allocated).toFixed(2));
  }
  return { allocations, unallocatedAmount: Math.max(0, remaining) };
}

module.exports = { allocateInvoicePayment };
