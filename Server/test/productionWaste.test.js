const test = require('node:test');
const assert = require('node:assert/strict');
const { WASTE_CATEGORIES, normalizeWasteBreakdown } = require('../src/utils/productionWaste');

test('accepts classified scrap whose category weights equal measured recoverable waste', () => {
  const result = normalizeWasteBreakdown([
    { category: 'edge_trim', weightKg: 1.25, notes: 'Side trim' },
    { category: 'setup_waste', weightKg: 0.75 }
  ], 2);
  assert.deepEqual(result, [
    { category: 'edge_trim', weightKg: 1.25, notes: 'Side trim' },
    { category: 'setup_waste', weightKg: 0.75, notes: '' }
  ]);
});

test('requires categorized weights to reconcile exactly to measured recoverable scrap', () => {
  assert.throws(
    () => normalizeWasteBreakdown([{ category: 'edge_trim', weightKg: 1 }], 1.2),
    /must add up/
  );
});

test('accepts zero recoverable scrap only with an empty breakdown', () => {
  assert.deepEqual(normalizeWasteBreakdown([], 0), []);
  assert.throws(
    () => normalizeWasteBreakdown([{ category: 'edge_trim', weightKg: 0.1 }], 0),
    /must add up/
  );
});

test('rejects unknown and duplicate categories', () => {
  assert.throws(() => normalizeWasteBreakdown([{ category: 'unknown', weightKg: 1 }], 1), /valid waste category/);
  assert.throws(() => normalizeWasteBreakdown([
    { category: 'edge_trim', weightKg: 0.5 },
    { category: 'edge_trim', weightKg: 0.5 }
  ], 1), /only once/);
});

test('rejects invalid weights and overlong notes', () => {
  assert.throws(() => normalizeWasteBreakdown([{ category: 'edge_trim', weightKg: -1 }], 0), /positive numbers/);
  assert.throws(() => normalizeWasteBreakdown([{ category: 'edge_trim', weightKg: 1, notes: 'x'.repeat(251) }], 1), /at most 250/);
});

test('exposes the supported waste categories for UI and validation', () => {
  assert.deepEqual(WASTE_CATEGORIES, ['edge_trim', 'setup_waste', 'quality_rejection', 'moisture_damage', 'handling_damage', 'other']);
});
