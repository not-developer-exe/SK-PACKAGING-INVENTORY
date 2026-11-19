const ReelUnit = require('../models/ReelUnit.model');
const CutSheetBatch = require('../models/CutSheetBatch.model');
const FacingMaterialBatch = require('../models/FacingMaterialBatch.model');
const CorrugatedSheet = require('../models/CorrugatedSheet.model');
const FinishedBox = require('../models/FinishedBox.model');
const RawMaterial = require('../models/RawMaterial.model');
const StockMovement = require('../models/StockMovement.model');
const RawMaterialMovement = require('../models/RawMaterialMovement.model');
const { buildDateRangeFilter } = require('../utils/dateFilters');

const asNumber = (value) => Number(value?.toString?.() ?? value ?? 0) || 0;
const companyMatch = (req) => req.companyKey === 'nsb-industrial-solutions'
  ? { companyKey: 'nsb-industrial-solutions' }
  : { $or: [{ companyKey: 'sk-packaging' }, { companyKey: { $exists: false } }] };

function valueLine(category, quantity, unit, rate, rateAvailable = true) {
  const qty = asNumber(quantity);
  const unitRate = asNumber(rate);
  const costed = rateAvailable && unitRate > 0;
  return {
    category, quantity: qty, unit, averageRate: costed ? unitRate : null,
    stockValue: costed ? Number((qty * unitRate).toFixed(2)) : null,
    costingStatus: costed ? 'available' : 'pending'
  };
}

exports.getInventoryValuation = async (req, res) => {
  try {
    const scope = companyMatch(req);
    const [reels, cutSheets, facing, corrugated, finished, rawMaterials] = await Promise.all([
      ReelUnit.find({ ...scope, status: { $in: ['available', 'partial'] } }).lean(),
      CutSheetBatch.find({ ...scope, status: { $in: ['available', 'partially_used'] } }).lean(),
      FacingMaterialBatch.find({ ...scope, status: { $in: ['available', 'partial'] } }).lean(),
      CorrugatedSheet.find({ ...scope, status: 'available' }).lean(),
      FinishedBox.find({ ...scope, status: 'available', quantityAvailable: { $gt: 0 } }).lean(),
      RawMaterial.find({ ...scope, isActive: true }).lean()
    ]);

    const lines = [];
    const reelGroups = new Map();
    for (const reel of reels) {
      const key = [reel.reelWidthInches, reel.bf, reel.gsm, reel.quality].join('|');
      const entry = reelGroups.get(key) || { qty: 0, value: 0, hasRate: true, rateWeight: 0 };
      const kg = asNumber(reel.remainingWeightKg);
      const rate = asNumber(reel.landedRatePerKg) || asNumber(reel.ratePerKg);
      entry.qty += kg;
      if (rate > 0) { entry.value += kg * rate; entry.rateWeight += kg; } else entry.hasRate = false;
      reelGroups.set(key, entry);
    }
    for (const [spec, group] of reelGroups) {
      const rate = group.qty > 0 && group.hasRate ? group.value / group.qty : 0;
      lines.push(valueLine('Reels · ' + spec.replaceAll('|', ' / '), group.qty, 'kg', rate, group.hasRate));
    }

    const sumBatches = (docs, category, qtyField, rateField, unit) => {
      const groups = new Map();
      for (const doc of docs) {
        const key = category;
        const entry = groups.get(key) || { qty: 0, value: 0, hasRate: true };
        const qty = asNumber(doc[qtyField]);
        const rate = asNumber(doc[rateField]);
        entry.qty += qty;
        if (rate > 0) entry.value += qty * rate; else entry.hasRate = false;
        groups.set(key, entry);
      }
      for (const [name, entry] of groups) {
        const rate = entry.qty > 0 && entry.hasRate ? entry.value / entry.qty : 0;
        lines.push(valueLine(name, entry.qty, unit, rate, entry.hasRate));
      }
    };
    sumBatches(cutSheets, 'Cut sheets', 'remainingWeightKg', 'unitCostPerKg', 'kg');
    sumBatches(facing, 'Facing materials', 'remainingWeightKg', 'ratePerKg', 'kg');
    sumBatches(corrugated, 'Corrugated sheets', 'totalWeightKg', 'unitCostPerKg', 'kg');

    const boxGroups = new Map();
    for (const box of finished) {
      const key = box.itemName || 'Unspecified finished goods';
      const entry = boxGroups.get(key) || { qty: 0, value: 0, hasRate: true };
      const count = asNumber(box.quantityAvailable);
      const rate = box.costingStatus === 'available' ? asNumber(box.costPerBox) : 0;
      entry.qty += count;
      if (rate > 0) entry.value += count * rate; else entry.hasRate = false;
      boxGroups.set(key, entry);
    }
    for (const [name, entry] of boxGroups) {
      const rate = entry.qty > 0 && entry.hasRate ? entry.value / entry.qty : 0;
      lines.push(valueLine('Finished goods · ' + name, entry.qty, 'boxes', rate, entry.hasRate));
    }
    for (const material of rawMaterials) {
      lines.push(valueLine('Raw material · ' + material.name, material.currentQty, material.uom, material.averageRate, material.averageRate > 0));
    }

    const from = req.query.from;
    const to = req.query.to;
    const dateFilter = buildDateRangeFilter(from, to, 'movementDate');
    const movementFilter = { ...scope, ...(dateFilter.movementDate ? { movementDate: dateFilter.movementDate } : {}) };
    const rawDateFilter = buildDateRangeFilter(from, to, 'movementDate');
    const [movements, rawMovements] = await Promise.all([
      StockMovement.find(movementFilter).select('movementDate movementType itemType quantityChange weightChangeKg').lean().limit(10000),
      RawMaterialMovement.find({ ...scope, ...(rawDateFilter.movementDate ? { movementDate: rawDateFilter.movementDate } : {}) }).select('movementDate movementType quantity amount').lean().limit(10000)
    ]);
    const buckets = new Map();
    const add = (date, key, value) => {
      const bucket = buckets.get(key) || { key, stockMovements: 0, weightInKg: 0, quantityChange: 0, rawMaterialMovements: 0, rawMaterialQuantity: 0, rawMaterialValue: 0 };
      bucket.stockMovements += 1;
      bucket.weightInKg += value.weight;
      bucket.quantityChange += value.quantity;
      bucket.rawMaterialMovements += value.rawCount || 0;
      bucket.rawMaterialQuantity += value.rawQty || 0;
      bucket.rawMaterialValue += value.rawValue || 0;
      buckets.set(key, bucket);
    };
    const groupBy = req.query.groupBy === 'month' ? 'month' : 'day';
    const keyFor = (date) => {
      const d = new Date(date);
      if (Number.isNaN(d.getTime())) return 'unknown';
      return groupBy === 'month'
        ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
        : d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    };
    for (const movement of movements) add(movement.movementDate, keyFor(movement.movementDate), {
      weight: asNumber(movement.weightChangeKg), quantity: asNumber(movement.quantityChange)
    });
    for (const movement of rawMovements) {
      const key = keyFor(movement.movementDate);
      const bucket = buckets.get(key) || { key, stockMovements: 0, weightInKg: 0, quantityChange: 0, rawMaterialMovements: 0, rawMaterialQuantity: 0, rawMaterialValue: 0 };
      bucket.rawMaterialMovements += 1;
      bucket.rawMaterialQuantity += asNumber(movement.quantity) * (movement.movementType === 'issue' || movement.movementType === 'adjustment_out' ? -1 : 1);
      bucket.rawMaterialValue += asNumber(movement.amount) * (movement.movementType === 'issue' || movement.movementType === 'adjustment_out' ? -1 : 1);
      buckets.set(key, bucket);
    }
    const valued = lines.filter(line => line.stockValue !== null);
    const pending = lines.filter(line => line.stockValue === null);
    const knownValue = valued.reduce((sum, line) => sum + line.stockValue, 0);
    return res.json({
      asOf: new Date().toISOString(),
      companyKey: req.companyKey || 'sk-packaging',
      valuation: {
        knownStockValue: Number(knownValue.toFixed(2)),
        valuedCategories: valued.length,
        pendingCategories: pending.length,
        complete: pending.length === 0,
        lines
      },
      movementPeriod: { from: from || null, to: to || null, groupBy },
      dailyMonthlyMovements: [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key)).map(row => ({
        ...row, weightInKg: Number(row.weightInKg.toFixed(3)),
        quantityChange: Number(row.quantityChange.toFixed(3)),
        rawMaterialQuantity: Number(row.rawMaterialQuantity.toFixed(3)),
        rawMaterialValue: Number(row.rawMaterialValue.toFixed(2))
      }))
    });
  } catch (error) {
    console.error('[INVENTORY VALUATION]', error);
    return res.status(error.statusCode || 500).json({ message: 'Unable to generate inventory valuation.', error: error.message });
  }
};
