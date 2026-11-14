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
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
    const filter = {};
    if (search) {
      const escaped = search.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replaceAll('{', '\\{').replaceAll('}', '\\}');
      const expression = new RegExp(escaped, 'i');
      const searchableStrings = Object.entries(Model.schema.paths)
        .filter(([path, schema]) => schema.instance === 'String' && !path.toLowerCase().includes('password'))
        .map(([path]) => ({ [path]: expression }));
      const conditions = [...searchableStrings];
      const numericSearch = Number(search);
      if (Number.isFinite(numericSearch)) {
        conditions.push(...Object.entries(Model.schema.paths)
          .filter(([, schema]) => schema.instance === 'Number')
          .map(([path]) => ({ [path]: numericSearch })));
      }
      if (conditions.length) filter.$or = conditions;
    }
    const [records, total] = await Promise.all([
      Model.find(filter).sort({ updatedAt: -1, createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Model.countDocuments(filter)
    ]);
    return res.json({ entity: req.params.entity, records: records.map(serialize), page, limit, total, totalPages: Math.ceil(total / limit) });
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

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const record = await Model.findById(req.params.id).session(session);
      if (!record) throw Object.assign(new Error('Record not found.'), { statusCode: 404 });
      const before = serialize(record);
      const editable = { ...document };
      for (const field of immutableFields) delete editable[field];
      delete editable.recordedBy;
      delete editable.createdBy;
      delete editable.updatedBy;

      record.set(editable);
      await record.validate();
      const changedFields = record.modifiedPaths().filter((path) => !immutableFields.has(path.split('.')[0]));
      await record.save({ session });

      const after = serialize(record);
      await writeAuditLog(req, {
        action: 'admin.record_overridden',
        entityType: Model.modelName,
        entityId: record._id,
        entityLabel: String(record._id),
        summary: 'Administrator edited ' + Model.modelName + ' record: ' + reason.trim(),
        metadata: { reason: reason.trim(), changedFields, before, after }
      }, session);
      result = { record: after, changedFields };
    });
    return res.json(result);
  } catch (error) {
    console.error('[ADMIN RECORDS] Update failed:', error.message);
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ message: error.message });
    }
    return res.status(error.statusCode || 500).json({ message: error.message || 'Unable to update this record.' });
  } finally {
    await session.endSession();
  }
};
