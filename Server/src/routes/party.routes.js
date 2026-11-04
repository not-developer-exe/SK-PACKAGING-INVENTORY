const express = require('express');
const router = express.Router();
const { getParties, createParty, togglePartyStatus } = require('../controllers/party.controller');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect); // All party routes require authentication

router.get('/', getParties);
router.post('/', createParty);
router.patch('/:id/status', togglePartyStatus);

module.exports = router;