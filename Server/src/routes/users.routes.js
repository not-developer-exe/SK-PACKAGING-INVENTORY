const express = require('express');
const router = express.Router();
const { listUsers, createUser, updateUser } = require('../controllers/users.controller');
const { protect } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');

router.use(protect, requireRole('admin'));
router.get('/', listUsers);
router.post('/', createUser);
router.patch('/:id', updateUser);

module.exports = router;
