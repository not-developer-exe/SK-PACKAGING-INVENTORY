const test = require('node:test');
const assert = require('node:assert/strict');
const { isValidDateOnly, buildDateRangeFilter } = require('../src/utils/dateFilters');

test('accepts real calendar dates and leap days', () => {
  assert.equal(isValidDateOnly('2024-02-29'), true);
  assert.equal(isValidDateOnly('2026-11-14'), true);
  assert.equal(isValidDateOnly('2026-02-29'), false);
  assert.equal(isValidDateOnly('14-11-2026'), false);
});

test('builds an inclusive India-local date range using an exclusive next-day boundary', () => {
  const filter = buildDateRangeFilter('2026-11-01', '2026-11-30', 'runDate');
  assert.equal(filter.runDate.$gte.toISOString(), '2026-10-31T18:30:00.000Z');
  assert.equal(filter.runDate.$lt.toISOString(), '2026-11-30T18:30:00.000Z');
});

test('supports open-ended ranges', () => {
  assert.deepEqual(buildDateRangeFilter('2026-11-01', undefined, 'createdAt'), {
    createdAt: { $gte: new Date('2026-10-31T18:30:00.000Z') }
  });
});

test('rejects invalid and reversed date ranges with HTTP 400 errors', () => {
  assert.throws(() => buildDateRangeFilter('2026-02-30', undefined, 'runDate'), { statusCode: 400 });
  assert.throws(() => buildDateRangeFilter('2026-11-15', '2026-11-14', 'runDate'), { statusCode: 400 });
});


test('formats default report dates using local calendar components', () => {
  const { formatDateOnlyLocal } = require('../src/utils/dateFilters');
  const date = new Date(2026, 10, 1, 0, 15, 0);
  assert.equal(formatDateOnlyLocal(date), '2026-11-01');
});
