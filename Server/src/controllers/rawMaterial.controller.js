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
  if (!code || !name || !['adhesive','packing','printing','consumable','colour','other'].includes(category) ||
      !['kg','g','litre','ml','pcs','roll','box','bundle','pending'].includes(uom) ||
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
  if (!mongoose.isValidObjectId(materialId) || !['opening','inward','issue','adjustment_in','adjustment_out'].includes(movementType) ||
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
      if (material.uom === 'pending' && movementType !== 'opening') {
        const e = new Error('This material unit is not verified yet. Confirm its unit before recording inward, issue or adjustments.');
        e.statusCode = 409; throw e;
      }
      if (movementType === 'opening') {
        const priorMovement = await RawMaterialMovement.exists({ materialId: material._id, movementType: 'opening' }).session(session);
        if (priorMovement || Number(material.openingQty || 0) > 0 || Number(material.currentQty || 0) > 0) {
          const e = new Error('An opening balance has already been posted or this material already has stock movements.');
          e.statusCode = 409; throw e;
        }
      }
      const isIn = movementType === 'opening' || movementType === 'inward' || movementType === 'adjustment_in';
      const delta = isIn ? quantity : -quantity;
      const updated = await RawMaterial.findOneAndUpdate(
        { _id: material._id, ...companyFilter(req), ...(movementType === 'opening' ? { openingQty: 0, currentQty: 0 } : delta < 0 ? { currentQty: { $gte: quantity } } : {}) },
        { $inc: { currentQty: delta, ...(movementType === 'opening' ? { openingQty: quantity } : {}) },
          ...((movementType === 'opening' || movementType === 'inward') && rate > 0 ? { $set: { averageRate: rate } } : {}) },
        { new: true, session }
      );
      if (!updated) { const e = new Error(movementType === 'opening' ? 'Opening balance already exists or this material has moved. Refresh and review the register.' : 'Insufficient stock. Issue quantity exceeds available balance.'); e.statusCode = 409; throw e; }
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

exports.updateMaterialUnit = async (req, res) => {
  const { id } = req.params;
  const uom = req.body?.uom;
  if (!mongoose.isValidObjectId(id) || !['kg','g','litre','ml','pcs','roll','box','bundle'].includes(uom)) {
    return res.status(400).json({ message: 'Select a valid unit of measure.' });
  }
  try {
    const material = await RawMaterial.findOneAndUpdate(
      { _id: id, ...companyFilter(req), isActive: true, uom: 'pending' },
      { $set: { uom } }, { new: true, runValidators: true }
    );
    if (!material) return res.status(409).json({ message: 'Material not found or its unit has already been confirmed.' });
    await writeAuditLog(req, { action: 'raw_material.unit_confirmed', entityType: 'RawMaterial', entityId: material._id,
      entityLabel: material.name, summary: 'Confirmed unit for ' + material.name + ': ' + uom, metadata: { uom } });
    return res.json({ material });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to update material unit.' });
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
