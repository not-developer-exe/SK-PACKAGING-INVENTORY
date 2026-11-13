const Party = require('../models/party.model');

exports.getParties = async (req, res) => {
  try {
    const parties = await Party.find().sort({ updatedAt: -1 });
    res.json(parties);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

exports.createParty = async (req, res) => {
  try {
    const { name, type, phone, city, openingBalance = 0 } = req.body;
    
    const newParty = new Party({
      name, type, phone, city, balance: openingBalance,
      ledger: openingBalance !== 0 ? [{
        type: 'Opening Balance',
        ref: '-',
        debit: openingBalance < 0 ? Math.abs(openingBalance) : 0, 
        credit: openingBalance > 0 ? openingBalance : 0,
        balance: openingBalance
      }] : []
    });

    await newParty.save();
    res.status(201).json(newParty);
  } catch (error) {
    res.status(400).json({ message: 'Failed to create party', error: error.message });
  }
};

exports.deleteParty = async (req, res) => {
  try {
    const party = await Party.findById(req.params.id);
    if (!party) return res.status(404).json({ message: 'Party not found' });
    
    // Protected Delete Logic
    if (party.balance !== 0) {
      return res.status(400).json({ message: 'Cannot delete. Settle balance to ₹0 first.' });
    }

    await party.deleteOne();
    res.json({ message: 'Party deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

exports.addTransaction = async (req, res) => {
  try {
    const { amount, mode, ref, direction } = req.body; // direction: 'in' or 'out'
    const party = await Party.findById(req.params.id);
    
    if (!party) return res.status(404).json({ message: 'Party not found' });

    const isPaymentIn = direction === 'in';
    const newBalance = isPaymentIn ? party.balance - amount : party.balance + amount;

    const newTxn = {
      type: isPaymentIn ? 'Payment Received' : 'Payment Sent',
      ref: `${mode}${ref ? ' / ' + ref : ''}`,
      debit: isPaymentIn ? 0 : amount,
      credit: isPaymentIn ? amount : 0,
      balance: newBalance
    };

    party.ledger.push(newTxn);
    party.balance = newBalance;
    await party.save();

    res.json(party);
  } catch (error) {
    res.status(400).json({ message: 'Failed to record transaction', error: error.message });
  }
};

exports.deleteTransaction = async (req, res) => {
  try {
    const party = await Party.findById(req.params.partyId);
    if (!party) return res.status(404).json({ message: 'Party not found' });

    const txn = party.ledger.id(req.params.txnId);
    if (!txn) return res.status(404).json({ message: 'Transaction not found' });

    // Reverse the financial impact of the deleted transaction
    const impact = (txn.credit || 0) - (txn.debit || 0);
    party.balance = party.balance + impact;
    
    party.ledger.pull({ _id: req.params.txnId });
    await party.save();

    res.json(party);
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete transaction', error: error.message });
  }
};