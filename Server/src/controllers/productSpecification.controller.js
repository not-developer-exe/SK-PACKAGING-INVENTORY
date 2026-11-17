const mongoose = require('mongoose');
const ProductSpecification = require('../models/ProductSpecification.model');
const Party = require('../models/Party.model');
const writeAuditLog = require('../utils/writeAuditLog');

function normalizePayload(body = {}) {
  const productName = typeof body.productName === 'string' ? body.productName.trim() : '';
  const dimensions = body.dimensions || {};
  const sheetSpecification = body.sheetSpecification || {};
  const numeric = {
    ply: Number(body.ply),
    length: Number(dimensions.length),
    width: Number(dimensions.width),
    height: Number(dimensions.height),
    sheetLengthInches: Number(sheetSpecification.lengthInches),
    sheetWidthInches: Number(sheetSpecification.widthInches),
    sheetsPerBox: Number(body.sheetsPerBox),
    expectedKgPerBox: Number(body.expectedKgPerBox)
  };
  if (productName.length < 2 || productName.length > 120 ||
      ![3, 5, 7, 9].includes(numeric.ply) ||
      Object.entries(numeric).some(([key, value]) => key !== 'ply' && (!Number.isFinite(value) || value <= 0)) ||
      (body.notes !== undefined && (typeof body.notes !== 'string' || body.notes.length > 500))) {
    const error = new Error('Enter a product name, valid ply, positive box and sheet dimensions, sheets per box and expected kg per box.');
    error.statusCode = 400;
    throw error;
  }
  if (!mongoose.isValidObjectId(body.customerId)) {
    const error = new Error('Select a valid customer.');
    error.statusCode = 400;
    throw error;
  }
  return {
    customerId: body.customerId,
    productName,
    ply: numeric.ply,
    dimensions: { length: numeric.length, width: numeric.width, height: numeric.height },
    sheetSpecification: { lengthInches: numeric.sheetLengthInches, widthInches: numeric.sheetWidthInches },
    sheetsPerBox: numeric.sheetsPerBox,
    expectedKgPerBox: mongoose.Types.Decimal128.fromString(String(numeric.expectedKgPerBox)),
    notes: typeof body.notes === 'string' ? body.notes.trim() : ''
  };
}

exports.getProductSpecifications = async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.query.customerId) {
      if (!mongoose.isValidObjectId(req.query.customerId)) return res.status(400).json({ message: 'Invalid customer ID.' });
      filter.customerId = req.query.customerId;
    }
    const products = await ProductSpecification.find(filter)
      .populate('customerId', 'name')
      .sort({ productName: 1 })
      .lean();
    return res.json({ products });
  } catch (error) {
    console.error('[PRODUCT SPECIFICATIONS] List failed:', error.message);
    return res.status(500).json({ message: 'Unable to load product specifications.' });
  }
};

exports.createProductSpecification = async (req, res) => {
  try {
    const payload = normalizePayload(req.body);
    const customer = await Party.findOne({ _id: payload.customerId, isActive: { $ne: false }, type: { $in: ['Customer', 'Both'] } });
    if (!customer) return res.status(400).json({ message: 'Selected party must be an active customer.' });
    const duplicate = await ProductSpecification.findOne({
      customerId: payload.customerId, productName: payload.productName, isActive: true
    }).collation({ locale: 'en', strength: 2 });
    if (duplicate) return res.status(409).json({ message: 'This customer already has an active product with that name.' });
    const product = await ProductSpecification.create({ ...payload, createdBy: req.user._id, updatedBy: req.user._id });
    await writeAuditLog(req, {
      action: 'product_specification.created',
      entityType: 'ProductSpecification',
      entityId: product._id,
      entityLabel: product.productName,
      summary: 'Product specification created: ' + product.productName,
      metadata: { customerId: String(customer._id), ply: product.ply, sheetsPerBox: product.sheetsPerBox, expectedKgPerBox: product.expectedKgPerBox.toString() }
    });
    await product.populate('customerId', 'name');
    return res.status(201).json({ product });
  } catch (error) {
    console.error('[PRODUCT SPECIFICATIONS] Create failed:', error.message);
    return res.status(error.statusCode || (error.code === 11000 ? 409 : 400)).json({ message: error.statusCode ? error.message : error.code === 11000 ? 'An active product with this name already exists for this customer.' : 'Unable to create product specification.' });
  }
};

exports.updateProductSpecification = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid product specification ID.' });
    const payload = normalizePayload(req.body);
    const customer = await Party.findOne({ _id: payload.customerId, isActive: { $ne: false }, type: { $in: ['Customer', 'Both'] } });
    if (!customer) return res.status(400).json({ message: 'Selected party must be an active customer.' });
    const duplicate = await ProductSpecification.findOne({
      _id: { $ne: req.params.id }, customerId: payload.customerId, productName: payload.productName, isActive: true
    }).collation({ locale: 'en', strength: 2 });
    if (duplicate) return res.status(409).json({ message: 'This customer already has an active product with that name.' });
    const product = await ProductSpecification.findOneAndUpdate(
      { _id: req.params.id, isActive: true },
      { $set: { ...payload, updatedBy: req.user._id } },
      { new: true, runValidators: true }
    ).populate('customerId', 'name');
    if (!product) return res.status(404).json({ message: 'Active product specification not found.' });
    await writeAuditLog(req, {
      action: 'product_specification.updated',
      entityType: 'ProductSpecification',
      entityId: product._id,
      entityLabel: product.productName,
      summary: 'Product specification updated: ' + product.productName,
      metadata: { customerId: String(customer._id), ply: product.ply, sheetsPerBox: product.sheetsPerBox, expectedKgPerBox: product.expectedKgPerBox.toString() }
    });
    return res.json({ product });
  } catch (error) {
    console.error('[PRODUCT SPECIFICATIONS] Update failed:', error.message);
    return res.status(error.statusCode || 400).json({ message: error.statusCode ? error.message : 'Unable to update product specification.' });
  }
};

exports.archiveProductSpecification = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid product specification ID.' });
    const product = await ProductSpecification.findOneAndUpdate(
      { _id: req.params.id, isActive: true },
      { $set: { isActive: false, updatedBy: req.user._id } },
      { new: true }
    );
    if (!product) return res.status(404).json({ message: 'Active product specification not found.' });
    await writeAuditLog(req, {
      action: 'product_specification.archived',
      entityType: 'ProductSpecification',
      entityId: product._id,
      entityLabel: product.productName,
      summary: 'Product specification archived: ' + product.productName
    });
    return res.json({ message: 'Product specification archived. Historical production records are retained.' });
  } catch (error) {
    console.error('[PRODUCT SPECIFICATIONS] Archive failed:', error.message);
    return res.status(500).json({ message: 'Unable to archive product specification.' });
  }
};
