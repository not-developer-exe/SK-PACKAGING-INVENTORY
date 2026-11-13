const express = require('express');
const router = express.Router();
const {
  getParties,
  createParty,
  updateParty,
  deleteParty,
  addTransaction,
  deleteTransaction
} = require('../controllers/party.controller');
const { protect } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');

router.use(protect);
router.get('/', getParties);
router.post('/', createParty);
router.patch('/:id', updateParty);
router.delete('/:id', requireRole('admin'), deleteParty);
router.post('/:id/transaction', addTransaction);
router.delete('/:partyId/transaction/:txnId', requireRole('admin'), deleteTransaction);

module.exports = router;
