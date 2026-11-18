const express = require('express');
const router = express.Router();
const {
  getProductSpecifications,
  createProductSpecification,
  updateProductSpecification,
  archiveProductSpecification
} = require('../controllers/productSpecification.controller');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);
router.get('/', getProductSpecifications);
router.post('/', createProductSpecification);
router.patch('/:id', updateProductSpecification);
router.delete('/:id', archiveProductSpecification);

module.exports = router;
