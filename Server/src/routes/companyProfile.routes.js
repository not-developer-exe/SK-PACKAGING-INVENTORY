const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');
const { getCompanyProfile, saveCompanyProfile } = require('../controllers/companyProfile.controller');
router.use(protect, requireRole('admin'));
router.get('/', getCompanyProfile);
router.put('/', saveCompanyProfile);
module.exports = router;
