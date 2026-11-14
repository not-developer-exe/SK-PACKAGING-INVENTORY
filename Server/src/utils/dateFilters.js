const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateOnly(value) {
  if (typeof value !== 'string' || !DATE_ONLY_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

function buildDateRangeFilter(from, to, field) {
  if (!from && !to) return {};
  if ((from && !isValidDateOnly(from)) || (to && !isValidDateOnly(to))) {
    const error = new Error('Use real calendar dates in YYYY-MM-DD format.');
    error.statusCode = 400;
    throw error;
  }
  if (from && to && from > to) {
    const error = new Error('Start date must be on or before end date.');
    error.statusCode = 400;
    throw error;
  }

  const range = {};
  if (from) range.$gte = new Date(from + 'T00:00:00+05:30');
  if (to) {
    const end = new Date(to + 'T00:00:00+05:30');
    end.setDate(end.getDate() + 1);
    range.$lt = end;
  }
  return { [field]: range };
}

module.exports = { isValidDateOnly, buildDateRangeFilter };
