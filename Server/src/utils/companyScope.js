// Default operational queries to S.K Packaging. Legacy untagged records remain visible there.
// Queries that explicitly carry a companyKey (including inside $and/$or) keep their own scope.
function containsCompanyKey(value) {
  if (!value || typeof value !== 'object') return false;
  if (Object.prototype.hasOwnProperty.call(value, 'companyKey')) return true;
  return Object.values(value).some((child) => Array.isArray(child)
    ? child.some(containsCompanyKey)
    : containsCompanyKey(child));
}

module.exports = function companyScopePlugin(schema) {
  const legacySkScope = { $or: [{ companyKey: 'sk-packaging' }, { companyKey: { $exists: false } }] };
  const queryOperations = ['find', 'findOne', 'countDocuments', 'findOneAndUpdate', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany', 'replaceOne'];
  queryOperations.forEach((operation) => {
    schema.pre(operation, function applyCompanyScope() {
      const query = this.getQuery() || {};
      if (containsCompanyKey(query)) return;
      this.setQuery({ $and: [query, legacySkScope] });
    });
  });
  schema.pre('aggregate', function applyAggregateCompanyScope() {
    const pipeline = this.pipeline();
    const explicitMatch = pipeline.find((stage) => stage.$match)?.$match;
    if (containsCompanyKey(explicitMatch)) return;
    pipeline.unshift({ $match: legacySkScope });
  });
};
