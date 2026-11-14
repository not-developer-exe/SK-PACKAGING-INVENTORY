const WASTE_CATEGORIES = [
  'edge_trim',
  'setup_waste',
  'quality_rejection',
  'moisture_damage',
  'handling_damage',
  'other'
];

function normalizeWasteBreakdown(rows, recoverableWasteKg) {
  const recoverable = Number(recoverableWasteKg);
  if (!Array.isArray(rows)) {
    throw Object.assign(new TypeError('Waste breakdown must be a list.'), { statusCode: 400 });
  }

  const normalized = [];
  const seen = new Set();
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw Object.assign(new TypeError('Each waste breakdown row must be an object.'), { statusCode: 400 });
    }
    const category = typeof row.category === 'string' ? row.category.trim() : '';
    const weightKg = Number(row.weightKg);
    const notes = row.notes === undefined || row.notes === null ? '' : row.notes;
    if (!WASTE_CATEGORIES.includes(category)) {
      throw Object.assign(new TypeError('Select a valid waste category.'), { statusCode: 400 });
    }
    if (seen.has(category)) {
      throw Object.assign(new TypeError('Each waste category can be entered only once.'), { statusCode: 400 });
    }
    if (!Number.isFinite(weightKg) || weightKg <= 0) {
      throw Object.assign(new TypeError('Waste category weights must be positive numbers.'), { statusCode: 400 });
    }
    if (typeof notes !== 'string' || notes.trim().length > 250) {
      throw Object.assign(new TypeError('Waste notes must be text of at most 250 characters.'), { statusCode: 400 });
    }
    seen.add(category);
    normalized.push({ category, weightKg: Number(weightKg.toFixed(3)), notes: notes.trim() });
  }

  const classifiedTotal = Number(normalized.reduce((sum, row) => sum + row.weightKg, 0).toFixed(3));
  const target = Number(recoverable.toFixed(3));
  if (Math.abs(classifiedTotal - target) > 0.005) {
    throw Object.assign(new RangeError('Waste category weights must add up to the measured recoverable scrap total.'), { statusCode: 400 });
  }
  return normalized;
}

module.exports = { WASTE_CATEGORIES, normalizeWasteBreakdown };
