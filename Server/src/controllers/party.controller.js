const mongoose = require('mongoose');
const Party = require('../models/Party.model');
const writeAuditLog = require('../utils/writeAuditLog');
const Invoice = require('../models/Invoice.model');
const { allocateInvoicePayment } = require('../utils/invoicePaymentAllocation');
const { recalculatePartyLedger } = require('../utils/partyLedger');
const { isValidDateOnly } = require('../utils/dateFilters');

async function auditPartyChange(req, action, party, summary, metadata = {}) {
  await writeAuditLog(req, {
    action,
    entityType: 'Party',
    entityId: party._id,
    entityLabel: party.name,
    summary,
    metadata
  });
}

exports.getParties = async (req, res) => {
  try {
    const parties = await Party.find({ isActive: { $ne: false } }).sort({ name: 1 }).lean();
    return res.json(parties);
  } catch (error) {
    console.error('[PARTIES] List failed:', error.message);
    return res.status(500).json({ message: 'Unable to load parties.' });
  }
};

exports.createParty = async (req, res) => {
  const { name, type, phone = '', city = '', openingBalance = 0 } = req.body || {};
  const balance = Number(openingBalance);
  if (typeof name !== 'string' || name.trim().length < 2 ||
      !['Customer', 'Supplier', 'Both'].includes(type) ||
      !Number.isFinite(balance)) {
    return res.status(400).json({ message: 'Enter a party name, valid party type and finite opening balance.' });
  }

  try {
    const duplicate = await Party.findOne({ isActive: { $ne: false }, name: new RegExp('^' + name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') });
    if (duplicate) return res.status(409).json({ message: 'A party with this name already exists.' });

    const newParty = new Party({
      name: name.trim(),
      type,
      phone: typeof phone === 'string' ? phone.trim() : '',
      city: typeof city === 'string' ? city.trim() : '',
      balance,
      ledger: balance !== 0 ? [{
        type: 'Opening Balance',
        ref: 'OPENING',
        debit: balance > 0 ? balance : 0,
        credit: balance < 0 ? Math.abs(balance) : 0,
        balance
      }] : []
    });

    await newParty.save();
    await auditPartyChange(req, 'party.created', newParty, 'Party created: ' + newParty.name, { type, openingBalance: balance });
    return res.status(201).json(newParty);
  } catch (error) {
    console.error('[PARTIES] Create failed:', error.message);
    return res.status(400).json({ message: 'Unable to create party.' });
  }
};

exports.updateParty = async (req, res) => {
  const { name, phone, city, type } = req.body || {};
  if (name !== undefined && (typeof name !== 'string' || name.trim().length < 2)) {
    return res.status(400).json({ message: 'Party name must contain at least 2 characters.' });
  }
  if (phone !== undefined && typeof phone !== 'string') return res.status(400).json({ message: 'Phone must be text.' });
  if (city !== undefined && typeof city !== 'string') return res.status(400).json({ message: 'City must be text.' });
  if (type !== undefined && !['Customer', 'Supplier', 'Both'].includes(type)) {
    return res.status(400).json({ message: 'Invalid party type.' });
  }

  try {
    const party = await Party.findById(req.params.id);
    if (!party) return res.status(404).json({ message: 'Party not found.' });
    const before = { name: party.name, type: party.type, phone: party.phone, city: party.city };
    if (name !== undefined) party.name = name.trim();
    if (phone !== undefined) party.phone = phone.trim();
    if (city !== undefined) party.city = city.trim();
    if (type !== undefined && type !== party.type && party.ledger.some((entry) => entry.type !== 'Opening Balance')) {
      return res.status(409).json({ message: 'Party type cannot be changed after financial transactions have been recorded.' });
    }
    if (type !== undefined) party.type = type;
    await party.save();
    await auditPartyChange(req, 'party.updated', party, 'Party details updated: ' + party.name, { before, after: { name: party.name, type: party.type, phone: party.phone, city: party.city } });
    return res.json(party);
  } catch (error) {
    console.error('[PARTIES] Update failed:', error.message);
    return res.status(400).json({ message: 'Unable to update party details.' });
  }
};

exports.getArchivedParties = async (req, res) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Administrator access required.' });
  try {
    const parties = await Party.find({ isActive: false }).sort({ updatedAt: -1 }).lean();
    return res.json({ parties });
  } catch (error) {
    console.error('[PARTIES] Archived list failed:', error.message);
    return res.status(500).json({ message: 'Unable to load archived parties.' });
  }
};

exports.restoreParty = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let restoredParty;
    await session.withTransaction(async () => {
      const party = await Party.findById(req.params.id).session(session);
      if (!party || party.isActive !== false) {
        throw Object.assign(new Error('Archived party not found.'), { statusCode: 404 });
      }
      const duplicate = await Party.findOne({
        _id: { $ne: party._id },
        isActive: { $ne: false },
        name: party.name
      }).collation({ locale: 'en', strength: 2 }).session(session);
      if (duplicate) {
        throw Object.assign(new Error('Another active party already uses this name. Rename that party before restoring.'), { statusCode: 409 });
      }
      party.isActive = true;
      await party.save({ session });
      await writeAuditLog(req, {
        action: 'party.restored',
        entityType: 'Party',
        entityId: party._id,
        entityLabel: party.name,
        summary: 'Party restored: ' + party.name,
        metadata: { type: party.type, balance: party.balance, retainedLedgerEntries: party.ledger.length }
      }, session);
      restoredParty = party;
    });
    return res.json({ message: 'Party restored successfully.', party: restoredParty });
  } catch (error) {
    console.error('[PARTIES] Restore failed:', error.message);
    return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Unable to restore party.' });
  } finally {
    await session.endSession();
  }
};

exports.deleteParty = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let archivedParty;
    await session.withTransaction(async () => {
      const party = await Party.findById(req.params.id).session(session);
      if (!party || party.isActive === false) {
        throw Object.assign(new Error('Active party not found.'), { statusCode: 404 });
      }
      if (Math.abs(Number(party.balance || 0)) > 0.005) {
        throw Object.assign(new Error('Cannot archive this party while its outstanding balance is not settled. Settle the balance to ₹0 first.'), { statusCode: 409 });
      }
      const unpaidInvoice = await Invoice.findOne({
        customerId: party._id,
        balanceDue: { $gt: 0.005 },
        status: { $ne: 'Cancelled' }
      }).session(session);
      if (unpaidInvoice) {
        throw Object.assign(new Error('Cannot archive this party while invoice ' + unpaidInvoice.invoiceNumber + ' has an outstanding balance.'), { statusCode: 409 });
      }

      party.isActive = false;
      await party.save({ session });
      await writeAuditLog(req, {
        action: 'party.archived',
        entityType: 'Party',
        entityId: party._id,
        entityLabel: party.name,
        summary: 'Party archived: ' + party.name,
        metadata: { type: party.type, balance: party.balance, retainedLedgerEntries: party.ledger.length }
      }, session);
      archivedParty = party;
    });
    return res.json({ message: 'Party archived successfully. Historical transactions and linked records have been retained.', party: archivedParty });
  } catch (error) {
    console.error('[PARTIES] Archive failed:', error.message);
    return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Unable to archive party.' });
  } finally {
    await session.endSession();
  }
};

exports.addTransaction = async (req, res) => {
  const { amount: rawAmount, mode, ref = '', direction, date: rawDate } = req.body || {};
  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0 || !['in', 'out'].includes(direction) ||
      typeof mode !== 'string' || !mode.trim() || (ref !== '' && typeof ref !== 'string')) {
    return res.status(400).json({ message: 'Enter a positive amount, payment mode and valid direction.' });
  }
  if (rawDate !== undefined && !isValidDateOnly(rawDate)) {
    return res.status(400).json({ message: 'Payment date must be a real calendar date in YYYY-MM-DD format.' });
  }
  const paymentDate = rawDate ? new Date(rawDate + 'T00:00:00+05:30') : new Date();

  const session = await mongoose.startSession();
  try {
    let updatedParty;
    await session.withTransaction(async () => {
      const party = await Party.findById(req.params.id).session(session);
      if (!party || party.isActive === false) throw Object.assign(new Error('Active party not found.'), { statusCode: 404 });
      const isPaymentIn = direction === 'in';
      if (isPaymentIn && !['Customer', 'Both'].includes(party.type)) {
        throw Object.assign(new Error('Payment received can only be recorded for a customer.'), { statusCode: 400 });
      }
      if (!isPaymentIn && !['Supplier', 'Both'].includes(party.type)) {
        throw Object.assign(new Error('Payment sent can only be recorded for a supplier.'), { statusCode: 400 });
      }
      const newTxn = {
        date: paymentDate,
        type: isPaymentIn ? 'Payment Received' : 'Payment Sent',
        ref: mode.trim() + (ref.trim() ? ' / ' + ref.trim() : ''),
        debit: isPaymentIn ? 0 : amount,
        credit: isPaymentIn ? amount : 0,
        balance: 0
      };
      party.ledger.push(newTxn);
      const ledgerEntryId = party.ledger[party.ledger.length - 1]._id;
      const newBalance = recalculatePartyLedger(party.ledger);
      party.balance = newBalance;

      let invoiceAllocations = [];
      let unallocatedAmount = 0;
      if (isPaymentIn) {
        const openInvoices = await Invoice.find({ customerId: party._id, balanceDue: { $gt: 0 }, status: { $ne: 'Cancelled' } })
          .sort({ invoiceDate: 1, createdAt: 1, _id: 1 })
          .session(session);
        const allocation = allocateInvoicePayment(amount, openInvoices.map((invoice) => ({
          invoiceId: String(invoice._id),
          balanceDue: invoice.balanceDue
        })));
        invoiceAllocations = allocation.allocations;
        unallocatedAmount = allocation.unallocatedAmount;
        for (const item of invoiceAllocations) {
          const invoice = openInvoices.find((candidate) => String(candidate._id) === item.invoiceId);
          if (!invoice) throw new Error('Invoice allocation target disappeared during payment posting.');
          invoice.balanceDue = Number((invoice.balanceDue - item.amount).toFixed(2));
          if (invoice.balanceDue <= 0.005) {
            invoice.balanceDue = 0;
            invoice.status = 'Paid';
          } else {
            invoice.status = 'Pending';
          }
          invoice.payments.push({
            date: paymentDate,
            amount: item.amount,
            mode: mode.trim(),
            reference: ref.trim(),
            ledgerEntryId
          });
          await invoice.save({ session });
        }
      }

      await party.save({ session });
      await writeAuditLog(req, {
        action: 'party.payment_recorded',
        entityType: 'Party',
        entityId: party._id,
        entityLabel: party.name,
        summary: newTxn.type + ' recorded for ' + party.name,
        metadata: { amount, mode: mode.trim(), ref: ref.trim(), direction, resultingBalance: newBalance, invoiceAllocations, unallocatedAmount }
      }, session);
      updatedParty = party;
    });
    return res.json(updatedParty);
  } catch (error) {
    console.error('[PARTIES] Payment failed:', error.message);
    return res.status(error.statusCode || 400).json({ message: error.statusCode ? error.message : 'Unable to record payment.' });
  } finally {
    await session.endSession();
  }
};

exports.deleteTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let updatedParty;
    await session.withTransaction(async () => {
      const party = await Party.findById(req.params.partyId).session(session);
      if (!party) throw Object.assign(new Error('Party not found.'), { statusCode: 404 });
      const txn = party.ledger.id(req.params.txnId);
      if (!txn) throw Object.assign(new Error('Transaction not found.'), { statusCode: 404 });
      if (txn.type === 'Opening Balance') {
        throw Object.assign(new Error('Opening balance entries cannot be deleted.'), { statusCode: 409 });
      }

      if (txn.type === 'Tax Invoice') {
        throw Object.assign(new Error('Invoice ledger entries cannot be deleted directly. Use a dedicated invoice cancellation or credit-note process.'), { statusCode: 409 });
      }

      const removedEntry = { type: txn.type, ref: txn.ref, debit: txn.debit, credit: txn.credit };
      const linkedInvoices = await Invoice.find({ customerId: party._id, 'payments.ledgerEntryId': txn._id }).session(session);
      let reversedInvoiceAllocations = [];
      for (const invoice of linkedInvoices) {
        const matchingPayments = invoice.payments.filter((payment) => String(payment.ledgerEntryId) === String(txn._id));
        const reversedAmount = Number(matchingPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0).toFixed(2));
        invoice.balanceDue = Number((invoice.balanceDue + reversedAmount).toFixed(2));
        invoice.status = invoice.balanceDue <= 0.005 ? 'Paid' : 'Pending';
        invoice.payments = invoice.payments.filter((payment) => String(payment.ledgerEntryId) !== String(txn._id));
        await invoice.save({ session });
        reversedInvoiceAllocations.push({ invoiceNumber: invoice.invoiceNumber, amount: reversedAmount });
      }

      party.ledger.pull({ _id: req.params.txnId });
      party.balance = recalculatePartyLedger(party.ledger);
      await party.save({ session });
      await writeAuditLog(req, {
        action: 'party.transaction_deleted',
        entityType: 'Party',
        entityId: party._id,
        entityLabel: party.name,
        summary: 'Ledger entry deleted for ' + party.name,
        metadata: { removedEntry, reversedInvoiceAllocations, resultingBalance: party.balance }
      }, session);
      updatedParty = party;
    });
    return res.json(updatedParty);
  } catch (error) {
    console.error('[PARTIES] Ledger deletion failed:', error.message);
    return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Unable to delete ledger entry.' });
  } finally {
    await session.endSession();
  }
};
, 'i')
      }).session(session);
      if (duplicate) {
        throw Object.assign(new Error('Another active party already uses this name. Rename that party before restoring.'), { statusCode: 409 });
      }
      party.isActive = true;
      await party.save({ session });
      await writeAuditLog(req, {
        action: 'party.restored',
        entityType: 'Party',
        entityId: party._id,
        entityLabel: party.name,
        summary: 'Party restored: ' + party.name,
        metadata: { type: party.type, balance: party.balance, retainedLedgerEntries: party.ledger.length }
      }, session);
      restoredParty = party;
    });
    return res.json({ message: 'Party restored successfully.', party: restoredParty });
  } catch (error) {
    console.error('[PARTIES] Restore failed:', error.message);
    return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Unable to restore party.' });
  } finally {
    await session.endSession();
  }
};

exports.deleteParty = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let archivedParty;
    await session.withTransaction(async () => {
      const party = await Party.findById(req.params.id).session(session);
      if (!party || party.isActive === false) {
        throw Object.assign(new Error('Active party not found.'), { statusCode: 404 });
      }
      if (Math.abs(Number(party.balance || 0)) > 0.005) {
        throw Object.assign(new Error('Cannot archive this party while its outstanding balance is not settled. Settle the balance to ₹0 first.'), { statusCode: 409 });
      }
      const unpaidInvoice = await Invoice.findOne({
        customerId: party._id,
        balanceDue: { $gt: 0.005 },
        status: { $ne: 'Cancelled' }
      }).session(session);
      if (unpaidInvoice) {
        throw Object.assign(new Error('Cannot archive this party while invoice ' + unpaidInvoice.invoiceNumber + ' has an outstanding balance.'), { statusCode: 409 });
      }

      // Keep the historical ledger and linked documents intact. Archiving only
      // removes the party from active operational selectors.
      party.isActive = false;
      await party.save({ session });
      await writeAuditLog(req, {
        action: 'party.archived',
        entityType: 'Party',
        entityId: party._id,
        entityLabel: party.name,
        summary: 'Party archived: ' + party.name,
        metadata: { type: party.type, balance: party.balance, retainedLedgerEntries: party.ledger.length }
      }, session);
      archivedParty = party;
    });
    return res.json({ message: 'Party archived successfully. Historical transactions and linked records have been retained.', party: archivedParty });
  } catch (error) {
    console.error('[PARTIES] Archive failed:', error.message);
    return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Unable to archive party.' });
  } finally {
    await session.endSession();
  }
};

exports.addTransaction = async (req, res) => {
  const { amount: rawAmount, mode, ref = '', direction, date: rawDate } = req.body || {};
  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0 || !['in', 'out'].includes(direction) ||
      typeof mode !== 'string' || !mode.trim() || (ref !== '' && typeof ref !== 'string')) {
    return res.status(400).json({ message: 'Enter a positive amount, payment mode and valid direction.' });
  }
  if (rawDate !== undefined && !isValidDateOnly(rawDate)) {
    return res.status(400).json({ message: 'Payment date must be a real calendar date in YYYY-MM-DD format.' });
  }
  const paymentDate = rawDate ? new Date(rawDate + 'T00:00:00+05:30') : new Date();

  const session = await mongoose.startSession();
  try {
    let updatedParty;
    await session.withTransaction(async () => {
      const party = await Party.findById(req.params.id).session(session);
      if (!party || party.isActive === false) throw Object.assign(new Error('Active party not found.'), { statusCode: 404 });
      const isPaymentIn = direction === 'in';
      if (isPaymentIn && !['Customer', 'Both'].includes(party.type)) {
        throw Object.assign(new Error('Payment received can only be recorded for a customer.'), { statusCode: 400 });
      }
      if (!isPaymentIn && !['Supplier', 'Both'].includes(party.type)) {
        throw Object.assign(new Error('Payment sent can only be recorded for a supplier.'), { statusCode: 400 });
      }
      const newTxn = {
        date: paymentDate,
        type: isPaymentIn ? 'Payment Received' : 'Payment Sent',
        ref: mode.trim() + (ref.trim() ? ' / ' + ref.trim() : ''),
        debit: isPaymentIn ? 0 : amount,
        credit: isPaymentIn ? amount : 0,
        balance: 0
      };
      party.ledger.push(newTxn);
      const ledgerEntryId = party.ledger[party.ledger.length - 1]._id;
      const newBalance = recalculatePartyLedger(party.ledger);
      party.balance = newBalance;

      let invoiceAllocations = [];
      let unallocatedAmount = 0;
      if (isPaymentIn) {
        const openInvoices = await Invoice.find({ customerId: party._id, balanceDue: { $gt: 0 }, status: { $ne: 'Cancelled' } })
          .sort({ invoiceDate: 1, createdAt: 1, _id: 1 })
          .session(session);
        const allocation = allocateInvoicePayment(amount, openInvoices.map((invoice) => ({
          invoiceId: String(invoice._id),
          balanceDue: invoice.balanceDue
        })));
        invoiceAllocations = allocation.allocations;
        unallocatedAmount = allocation.unallocatedAmount;
        for (const item of invoiceAllocations) {
          const invoice = openInvoices.find((candidate) => String(candidate._id) === item.invoiceId);
          if (!invoice) throw new Error('Invoice allocation target disappeared during payment posting.');
          invoice.balanceDue = Number((invoice.balanceDue - item.amount).toFixed(2));
          if (invoice.balanceDue <= 0.005) {
            invoice.balanceDue = 0;
            invoice.status = 'Paid';
          } else {
            invoice.status = 'Pending';
          }
          invoice.payments.push({
            date: paymentDate,
            amount: item.amount,
            mode: mode.trim(),
            reference: ref.trim(),
            ledgerEntryId
          });
          await invoice.save({ session });
        }
      }

      await party.save({ session });
      await writeAuditLog(req, {
        action: 'party.payment_recorded',
        entityType: 'Party',
        entityId: party._id,
        entityLabel: party.name,
        summary: newTxn.type + ' recorded for ' + party.name,
        metadata: { amount, mode: mode.trim(), ref: ref.trim(), direction, resultingBalance: newBalance, invoiceAllocations, unallocatedAmount }
      }, session);
      updatedParty = party;
    });
    return res.json(updatedParty);
  } catch (error) {
    console.error('[PARTIES] Payment failed:', error.message);
    return res.status(error.statusCode || 400).json({ message: error.statusCode ? error.message : 'Unable to record payment.' });
  } finally {
    await session.endSession();
  }
};

exports.deleteTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let updatedParty;
    await session.withTransaction(async () => {
      const party = await Party.findById(req.params.partyId).session(session);
      if (!party) throw Object.assign(new Error('Party not found.'), { statusCode: 404 });
      const txn = party.ledger.id(req.params.txnId);
      if (!txn) throw Object.assign(new Error('Transaction not found.'), { statusCode: 404 });
      if (txn.type === 'Opening Balance') {
        throw Object.assign(new Error('Opening balance entries cannot be deleted.'), { statusCode: 409 });
      }

      if (txn.type === 'Tax Invoice') {
        throw Object.assign(new Error('Invoice ledger entries cannot be deleted directly. Use a dedicated invoice cancellation or credit-note process.'), { statusCode: 409 });
      }

      const removedEntry = { type: txn.type, ref: txn.ref, debit: txn.debit, credit: txn.credit };
      const linkedInvoices = await Invoice.find({ customerId: party._id, 'payments.ledgerEntryId': txn._id }).session(session);
      let reversedInvoiceAllocations = [];
      for (const invoice of linkedInvoices) {
        const matchingPayments = invoice.payments.filter((payment) => String(payment.ledgerEntryId) === String(txn._id));
        const reversedAmount = Number(matchingPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0).toFixed(2));
        invoice.balanceDue = Number((invoice.balanceDue + reversedAmount).toFixed(2));
        invoice.status = invoice.balanceDue <= 0.005 ? 'Paid' : 'Pending';
        invoice.payments = invoice.payments.filter((payment) => String(payment.ledgerEntryId) !== String(txn._id));
        await invoice.save({ session });
        reversedInvoiceAllocations.push({ invoiceNumber: invoice.invoiceNumber, amount: reversedAmount });
      }

      party.ledger.pull({ _id: req.params.txnId });
      party.balance = recalculatePartyLedger(party.ledger);
      await party.save({ session });
      await writeAuditLog(req, {
        action: 'party.transaction_deleted',
        entityType: 'Party',
        entityId: party._id,
        entityLabel: party.name,
        summary: 'Ledger entry deleted for ' + party.name,
        metadata: { removedEntry, reversedInvoiceAllocations, resultingBalance: party.balance }
      }, session);
      updatedParty = party;
    });
    return res.json(updatedParty);
  } catch (error) {
    console.error('[PARTIES] Ledger deletion failed:', error.message);
    return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Unable to delete ledger entry.' });
  } finally {
    await session.endSession();
  }
};
