const mongoose = require('mongoose');
const RawMaterial = require('../models/RawMaterial.model');
const RawMaterialMovement = require('../models/RawMaterialMovement.model');
const writeAuditLog = require('../utils/writeAuditLog');
const { buildDateRangeFilter, isValidDateOnly } = require('../utils/dateFilters');

const companyFilter = (req) => req.companyKey === 'nsb-industrial-solutions'
  ? { companyKey: 'nsb-industrial-solutions' }
  : { $or: [{ companyKey: 'sk-packaging' }, { companyKey: { $exists: false } }] };

exports.listMaterials = async (req, res) => {
  try {
    const materials = await RawMaterial.find({ ...companyFilter(req), ...(req.query.activeOnly === 'true' ? { isActive: true } : {}) }).sort({ name: 1 }).lean();
    return res.json({ materials });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to fetch raw materials.' });
  }
};

exports.createMaterial = async (req, res) => {
  const code = String(req.body?.code || '').trim().toUpperCase();
  const name = String(req.body?.name || '').trim();
  const category = req.body?.category || 'consumable';
  const uom = req.body?.uom;
  const reorderLevel = Number(req.body?.reorderLevel || 0);
  if (!code || !name || !['adhesive','packing','printing','consumable','other'].includes(category) ||
      !['kg','g','litre','ml','pcs','roll','box','bundle'].includes(uom) ||
      !Number.isFinite(reorderLevel) || reorderLevel < 0) {
    return res.status(400).json({ message: 'Enter a code, name, valid category, unit and non-negative reorder level.' });
  }
  try {
    const material = await RawMaterial.create({ companyKey: req.companyKey || 'sk-packaging', code, name, category, uom, reorderLevel });
    await writeAuditLog(req, { action: 'raw_material.created', entityType: 'RawMaterial', entityId: material._id, entityLabel: material.name, summary: 'Raw material created: ' + material.name });
    return res.status(201).json({ material });
  } catch (error) {
    return res.status(error.code === 11000 ? 409 : 400).json({ message: error.code === 11000 ? 'This material code already exists.' : 'Unable to create raw material.' });
  }
};

exports.recordMovement = async (req, res) => {
  const { materialId, movementType, reference = '', notes = '' } = req.body || {};
  const quantity = Number(req.body?.quantity);
  const rate = Number(req.body?.rate || 0);
  const rawDate = req.body?.movementDate;
  if (!mongoose.isValidObjectId(materialId) || !['inward','issue','adjustment_in','adjustment_out'].includes(movementType) ||
      !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(rate) || rate < 0 ||
      (rawDate !== undefined && !isValidDateOnly(rawDate))) {
    return res.status(400).json({ message: 'Select a material, movement type, positive quantity and valid rate/date.' });
  }
  const movementDate = rawDate ? new Date(rawDate + 'T00:00:00+05:30') : new Date();
  const session = await mongoose.startSession();
  try {
    let saved;
    await session.withTransaction(async () => {
      const material = await RawMaterial.findOne({ _id: materialId, ...companyFilter(req), isActive: true }).session(session);
      if (!material) { const e = new Error('Material not found or inactive.'); e.statusCode = 404; throw e; }
      const isIn = movementType === 'inward' || movementType === 'adjustment_in';
      const delta = isIn ? quantity : -quantity;
      const updated = await RawMaterial.findOneAndUpdate(
        { _id: material._id, ...companyFilter(req), ...(delta < 0 ? { currentQty: { $gte: quantity } } : {}) },
        { $inc: { currentQty: delta }, ...(movementType === 'inward' && rate > 0 ? { $set: { averageRate: rate } } : {}) },
        { new: true, session }
      );
      if (!updated) { const e = new Error('Insufficient stock. Issue quantity exceeds available balance.'); e.statusCode = 409; throw e; }
      const [movement] = await RawMaterialMovement.create([{
        companyKey: req.companyKey || 'sk-packaging', materialId: material._id, movementDate, movementType,
        quantity, rate, amount: Math.round(quantity * rate * 100) / 100,
        reference: String(reference).slice(0,120), notes: String(notes).slice(0,1000),
        balanceAfter: updated.currentQty, recordedBy: req.user?._id
      }], { session });
      await writeAuditLog(req, { action: 'raw_material.' + movementType, entityType: 'RawMaterialMovement', entityId: movement._id, entityLabel: material.name, summary: material.name + ' ' + movementType + ': ' + quantity + ' ' + material.uom, metadata: { quantity, rate, balanceAfter: updated.currentQty } }, session);
      saved = { movement, material: updated };
    });
    return res.status(201).json(saved);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Unable to record material movement.' });
  } finally {
    await session.endSession();
  }
};

exports.getMovements = async (req, res) => {
  try {
    const filter = { ...companyFilter(req), ...buildDateRangeFilter(req.query.from, req.query.to, 'movementDate') };
    if (req.query.materialId) {
      if (!mongoose.isValidObjectId(req.query.materialId)) return res.status(400).json({ message: 'Invalid material ID.' });
      filter.materialId = req.query.materialId;
    }
    const movements = await RawMaterialMovement.find(filter).populate('materialId', 'code name uom').populate('recordedBy', 'name').sort({ movementDate: -1, createdAt: -1 }).limit(2000).lean();
    return res.json({ movements });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to fetch material movements.' });
  }
};
