const express = require('express');
const router = express.Router();
const { getParties, createParty, deleteParty, addTransaction, deleteTransaction } = require('../controllers/party.controller');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);
router.get('/', getParties);
router.post('/', createParty);
router.delete('/:id', deleteParty);
router.post('/:id/transaction', addTransaction);
router.delete('/:partyId/transaction/:txnId', deleteTransaction);

module.exports = router;