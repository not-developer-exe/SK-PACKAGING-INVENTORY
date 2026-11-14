const test = require('node:test');
const assert = require('node:assert/strict');

function periodKey(date, mode) {
  const value = new Date(date);
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return mode === 'monthly' ? year + '-' + month : year + '-' + month + '-' + day;
}

test('report grouping keys preserve daily and monthly periods', () => {
  const date = '2026-11-14T12:00:00.000Z';
  assert.equal(periodKey(date, 'daily'), '2026-11-14');
  assert.equal(periodKey(date, 'monthly'), '2026-11');
});
