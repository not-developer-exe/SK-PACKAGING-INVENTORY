const mongoose = require('mongoose');
const writeAuditLog = require('../utils/writeAuditLog');

const models = {
  parties: require('../models/Party.model'),
  reels: require('../models/ReelUnit.model'),
  sheets: require('../models/CorrugatedSheet.model'),
  finishedBoxes: require('../models/FinishedBox.model'),
  productionRuns: require('../models/ProductionRun.model'),
  dispatches: require('../models/Dispatch.model'),
  invoices: require('../models/Invoice.model'),
  inwardReceipts: require('../models/InwardReceipt.model'),
  scrapSales: require('../models/ScrapSale.model'),
  wasteInventory: require('../models/WasteInventory.model'),
  stockMovements: require('../models/StockMovement.model'),
  openingStockAdjustments: require('../models/OpeningStockAdjustment.model'),
  stockReconciliations: require('../models/StockReconciliation.model'),
  expenses: require('../models/Expense.model')
};

const immutableFields = new Set(['_id', '__v', 'createdAt', 'updatedAt', 'password']);

function normalize(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    if (value._bsontype === 'ObjectId') return String(value);
    if (value._bsontype === 'Decimal128') return value.toString();
    if (typeof value.toHexString === 'function') return value.toHexString();
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, normalize(child)]));
  }
  return value;
}

function serialize(doc) {
  const value = normalize(doc.toObject ? doc.toObject({ depopulate: true }) : doc);
  delete value.password;
  return value;
}

exports.listAdminRecords = async (req, res) => {
  const Model = models[req.params.entity];
  if (!Model) return res.status(404).json({ message: 'Unsupported record type.' });
  try {
    const records = await Model.find().sort({ updatedAt: -1, createdAt: -1 }).limit(100).lean();
    return res.json({ entity: req.params.entity, records: records.map(serialize) });
  } catch (error) {
    console.error('[ADMIN RECORDS] List failed:', error.message);
    return res.status(500).json({ message: 'Unable to load records.' });
  }
};

exports.updateAdminRecord = async (req, res) => {
  const Model = models[req.params.entity];
  if (!Model) return res.status(404).json({ message: 'Unsupported record type.' });
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid record ID.' });
  const { document, reason } = req.body || {};
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    return res.status(400).json({ message: 'Provide the complete record as a JSON object.' });
  }
  if (typeof reason !== 'string' || reason.trim().length < 10 || reason.length > 500) {
    return res.status(400).json({ message: 'Enter an audit reason of at least 10 characters.' });
  }

  try {
    const record = await Model.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found.' });
    const before = serialize(record);
    const editable = { ...document };
    for (const field of immutableFields) delete editable[field];
    delete editable.recordedBy;
    delete editable.createdBy;
    delete editable.updatedBy;

    record.set(editable);
    await record.validate();
    const changedFields = record.modifiedPaths().filter((path) => !immutableFields.has(path.split('.')[0]));
    await record.save();

    const after = serialize(record);
    await writeAuditLog(req, {
      action: 'admin.record_overridden',
      entityType: Model.modelName,
      entityId: record._id,
      entityLabel: String(record._id),
      summary: 'Administrator edited ' + Model.modelName + ' record: ' + reason.trim(),
      metadata: { reason: reason.trim(), changedFields, before, after }
    });
    return res.json({ record: after, changedFields });
  } catch (error) {
    console.error('[ADMIN RECORDS] Update failed:', error.message);
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Unable to update this record.' });
  }
};
