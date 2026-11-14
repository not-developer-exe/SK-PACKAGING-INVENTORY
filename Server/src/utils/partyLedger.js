function recalculatePartyLedger(ledger) {
  if (!Array.isArray(ledger)) throw new TypeError('Party ledger must be an array.');

  const orderedEntries = [...ledger].sort((a, b) => {
    if (a.type === 'Opening Balance' && b.type !== 'Opening Balance') return -1;
    if (b.type === 'Opening Balance' && a.type !== 'Opening Balance') return 1;
    const dateDifference = new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime();
    if (dateDifference !== 0) return dateDifference;
    return String(a._id || '').localeCompare(String(b._id || ''));
  });

  let balance = 0;
  for (const entry of orderedEntries) {
    if (entry.type === 'Opening Balance') {
      // Preserve the signed opening balance snapshot, including older records whose
      // debit/credit columns were stored using the opposite convention.
      const openingBalance = Number(entry.balance);
      if (!Number.isFinite(openingBalance)) throw new TypeError('Opening balance must be finite.');
      balance = Number(openingBalance.toFixed(2));
    } else {
      const debit = Number(entry.debit || 0);
      const credit = Number(entry.credit || 0);
      if (!Number.isFinite(debit) || !Number.isFinite(credit)) {
        throw new TypeError('Ledger debit and credit values must be finite.');
      }
      balance = Number((balance + debit - credit).toFixed(2));
    }
    entry.balance = balance;
  }
  return balance;
}

module.exports = { recalculatePartyLedger };
