const express = require('express');
const router = express.Router();
const { 
  getParties, 
  createParty, 
  deleteParty, 
  addTransaction, 
  deleteTransaction 
} = require('../controllers/party.controller');

// Master Routes
router.get('/', getParties);
router.post('/', createParty);
router.delete('/:id', deleteParty);

// Khata (Ledger) Routes
router.post('/:id/transaction', addTransaction);
router.delete('/:partyId/transaction/:txnId', deleteTransaction);

module.exports = router;