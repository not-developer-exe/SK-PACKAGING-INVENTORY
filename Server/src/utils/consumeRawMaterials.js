const mongoose = require('mongoose');
const RawMaterial = require('../models/RawMaterial.model');
const RawMaterialMovement = require('../models/RawMaterialMovement.model');
const writeAuditLog = require('./writeAuditLog');

const companyFilter = (req) => req.companyKey === 'nsb-industrial-solutions'
  ? { companyKey: 'nsb-industrial-solutions' }
  : { $or: [{ companyKey: 'sk-packaging' }, { companyKey: { $exists: false } }] };

// Quantities are consumed in each material's own UOM; no implicit kg/litre/piece conversion.
async function consumeRawMaterials({ req, session, consumptions = [], movementDate, reference, notes }) {
  if (!Array.isArray(consumptions) || consumptions.length > 30) {
    const error = new Error('Raw-material consumption must contain no more than 30 lines.');
    error.statusCode = 400;
    throw error;
  }
  const seen = new Set();
  let totalCost = 0;
  const savedLines = [];
  for (const line of consumptions) {
    const materialId = line?.materialId;
    const quantity = Number(line?.quantity);
    if (!mongoose.isValidObjectId(materialId) || !Number.isFinite(quantity) || quantity <= 0 || seen.has(String(materialId))) {
      const error = new Error('Each raw-material line needs a unique material and positive quantity in its registered unit.');
      error.statusCode = 400;
      throw error;
    }
    seen.add(String(materialId));
    const material = await RawMaterial.findOne({ _id: materialId, ...companyFilter(req), isActive: true }).session(session);
    if (!material) {
      const error = new Error('A selected raw material is inactive, unavailable or outside S.K Packaging.');
      error.statusCode = 409;
      throw error;
    }
    if (material.uom === 'pending') {
      const error = new Error('Unit of measure for ' + material.name + ' is not verified. Confirm its unit before production consumption.');
      error.statusCode = 409;
      throw error;
    }
    const rate = Number(material.averageRate || 0);
    const amount = Number((quantity * rate).toFixed(2));
    const updated = await RawMaterial.findOneAndUpdate(
      { _id: material._id, ...companyFilter(req), isActive: true, currentQty: { $gte: quantity } },
      { $inc: { currentQty: -quantity } },
      { new: true, session }
    );
    if (!updated) {
      const error = new Error('Insufficient raw-material stock for ' + material.name + '. Available: ' + material.currentQty + ' ' + material.uom + '.');
      error.statusCode = 409;
      throw error;
    }
    const [movement] = await RawMaterialMovement.create([{
      companyKey: req.companyKey || 'sk-packaging',
      materialId: material._id,
      movementDate,
      movementType: 'issue',
      quantity,
      rate,
      amount,
      reference: String(reference).slice(0, 120),
      notes: String(notes || '').slice(0, 1000),
      balanceAfter: updated.currentQty,
      recordedBy: req.user?._id
    }], { session });
    await writeAuditLog(req, {
      action: 'raw_material.production_consumption',
      entityType: 'RawMaterialMovement',
      entityId: movement._id,
      entityLabel: material.name,
      summary: 'Consumed ' + quantity + ' ' + material.uom + ' of ' + material.name + ' in ' + reference,
      metadata: { quantity, uom: material.uom, rate, amount, balanceAfter: updated.currentQty, reference }
    }, session);
    totalCost += amount;
    savedLines.push({
      materialId: material._id,
      code: material.code,
      name: material.name,
      uom: material.uom,
      quantity,
      rate,
      amount
    });
  }
  return { totalCost: Number(totalCost.toFixed(2)), lines: savedLines };
}

module.exports = consumeRawMaterials;
