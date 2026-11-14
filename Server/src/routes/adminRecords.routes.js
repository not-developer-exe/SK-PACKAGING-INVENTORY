const express = require('express');
const router = express.Router();
const { listAdminRecords, updateAdminRecord } = require('../controllers/adminRecords.controller');
const { protect } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');

router.use(protect, requireRole('admin'));
router.get('/:entity', listAdminRecords);
router.patch('/:entity/:id', updateAdminRecord);

module.exports = router;
