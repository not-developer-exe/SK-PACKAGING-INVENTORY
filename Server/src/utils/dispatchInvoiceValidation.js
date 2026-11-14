function aggregateQuantities(lines, idField, quantityField) {
  const totals = new Map();
  for (const line of lines || []) {
    const id = String(line?.[idField]?._id || line?.[idField] || '');
    const quantity = Number(line?.[quantityField]);
    if (!id || !Number.isInteger(quantity) || quantity <= 0) return null;
    totals.set(id, (totals.get(id) || 0) + quantity);
  }
  return totals;
}

function matchesDispatchQuantities(dispatchLines, invoiceLines) {
  if (!Array.isArray(dispatchLines) || !dispatchLines.length ||
      !Array.isArray(invoiceLines) || !invoiceLines.length) return false;
  const dispatched = aggregateQuantities(dispatchLines, 'boxId', 'dispatchQuantity');
  const invoiced = aggregateQuantities(invoiceLines, 'boxId', 'quantity');
  if (!dispatched || !invoiced || dispatched.size !== invoiced.size) return false;
  for (const [id, quantity] of dispatched) {
    if (invoiced.get(id) !== quantity) return false;
  }
  return true;
}

module.exports = { matchesDispatchQuantities };
