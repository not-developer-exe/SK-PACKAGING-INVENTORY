const mongoose = require('mongoose');
const Party = require('../models/Party.model');
const writeAuditLog = require('../utils/writeAuditLog');
const AuditLog = require('../models/AuditLog.model');

async function auditPartyChange(req, action, party, summary, metadata = {}) {
  try {
    await AuditLog.create({
      action,
      entityType: 'Party',
      entityId: party._id,
      entityLabel: party.name,
      actorId: req.user._id,
      actorName: req.user.name,
      actorRole: req.user.role,
      summary,
      metadata
    });
  } catch (error) {
    console.error('[AUDIT] Party event could not be recorded:', error.message);
  }
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
        debit: balance < 0 ? Math.abs(balance) : 0,
        credit: balance > 0 ? balance : 0,
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

exports.deleteParty = async (req, res) => {
  try {
    const party = await Party.findById(req.params.id);
    if (!party) return res.status(404).json({ message: 'Party not found' });
    if (party.balance !== 0) {
      return res.status(400).json({ message: 'Cannot delete. Settle balance to ₹0 first.' });
    }
    if (party.ledger.some(entry => entry.type !== 'Opening Balance')) {
      return res.status(409).json({ message: 'This party has transaction history. It cannot be archived or deleted.' });
    }
    party.isActive = false;
    await party.save();
    await auditPartyChange(req, 'party.archived', party, 'Party archived: ' + party.name, { type: party.type });
    return res.json({ message: 'Party archived successfully' });
  } catch (error) {
    console.error('[PARTIES] Delete failed:', error.message);
    return res.status(500).json({ message: 'Unable to delete party.' });
  }
};

exports.addTransaction = async (req, res) => {
  const { amount: rawAmount, mode, ref = '', direction } = req.body || {};
  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0 || !['in', 'out'].includes(direction) ||
      typeof mode !== 'string' || !mode.trim() || (ref !== '' && typeof ref !== 'string')) {
    return res.status(400).json({ message: 'Enter a positive amount, payment mode and valid direction.' });
  }

  const session = await mongoose.startSession();
  try {
    let updatedParty;
    await session.withTransaction(async () => {
      const party = await Party.findById(req.params.id).session(session);
      if (!party) throw Object.assign(new Error('Party not found.'), { statusCode: 404 });
      const isPaymentIn = direction === 'in';
      const newBalance = isPaymentIn ? party.balance - amount : party.balance + amount;
      const newTxn = {
        type: isPaymentIn ? 'Payment Received' : 'Payment Sent',
        ref: mode.trim() + (ref.trim() ? ' / ' + ref.trim() : ''),
        debit: isPaymentIn ? 0 : amount,
        credit: isPaymentIn ? amount : 0,
        balance: newBalance
      };
      party.ledger.push(newTxn);
      party.balance = newBalance;
      await party.save({ session });
      await writeAuditLog(req, {
        action: 'party.payment_recorded',
        entityType: 'Party',
        entityId: party._id,
        entityLabel: party.name,
        summary: newTxn.type + ' recorded for ' + party.name,
        metadata: { amount, mode: mode.trim(), ref: ref.trim(), direction, resultingBalance: newBalance }
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

      const removedEntry = { type: txn.type, ref: txn.ref, debit: txn.debit, credit: txn.credit };
      party.balance += (txn.credit || 0) - (txn.debit || 0);
      party.ledger.pull({ _id: req.params.txnId });
      await party.save({ session });
      await writeAuditLog(req, {
        action: 'party.transaction_deleted',
        entityType: 'Party',
        entityId: party._id,
        entityLabel: party.name,
        summary: 'Ledger entry deleted for ' + party.name,
        metadata: { removedEntry, resultingBalance: party.balance }
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
