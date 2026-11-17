const express = require('express');
const router = express.Router();
const {
  getProductSpecifications,
  createProductSpecification,
  updateProductSpecification,
  archiveProductSpecification
} = require('../controllers/productSpecification.controller');
const { protect } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');

router.use(protect);
router.get('/', getProductSpecifications);
router.post('/', requireRole('admin'), createProductSpecification);
router.patch('/:id', requireRole('admin'), updateProductSpecification);
router.delete('/:id', requireRole('admin'), archiveProductSpecification);

module.exports = router;
