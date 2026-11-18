// Default all operational records to the S.K Packaging workspace.
// Legacy documents without companyKey remain visible only in that workspace.
// Explicit companyKey queries are reserved for future, separately authorised company routes.
module.exports = function companyScopePlugin(schema) {
  const legacySkScope = { $or: [{ companyKey: 'sk-packaging' }, { companyKey: { $exists: false } }] };
  schema.pre(['find', 'findOne', 'countDocuments', 'findOneAndUpdate', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany', 'replaceOne'], function applyCompanyScope() {
    const query = this.getQuery() || {};
    if (Object.prototype.hasOwnProperty.call(query, 'companyKey')) return;
    this.setQuery({ $and: [query, legacySkScope] });
  });
  schema.pre('aggregate', function applyAggregateCompanyScope() {
    const pipeline = this.pipeline();
    const explicitMatch = pipeline.find((stage) => stage.$match)?.$match;
    if (explicitMatch && Object.prototype.hasOwnProperty.call(explicitMatch, 'companyKey')) return;
    pipeline.unshift({ $match: legacySkScope });
  });
};
