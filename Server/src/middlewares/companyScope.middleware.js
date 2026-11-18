// Company access is selected by the API namespace, never by a client-supplied body field.
exports.useCompany = (companyKey) => (req, res, next) => {
  if (companyKey === 'nsb-industrial-solutions' && req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'NSB access is restricted to the owner.' });
  }
  req.companyKey = companyKey;
  return next();
};
