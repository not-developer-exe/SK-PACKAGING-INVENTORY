const mongoose = require('mongoose');
const companyScopePlugin = require('../utils/companyScope');

const auditLogSchema = new mongoose.Schema({
  companyKey: { type: String, enum: ['sk-packaging', 'nsb-industrial-solutions'], default: 'sk-packaging', index: true },
  action: { type: String, required: true, trim: true },
  entityType: { type: String, required: true, trim: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
  entityLabel: { type: String, trim: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  actorName: { type: String, trim: true },
  actorRole: { type: String, enum: ['admin', 'accountant'], required: true },
  summary: { type: String, required: true, trim: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

auditLogSchema.index({ createdAt: -1, entityType: 1 });
auditLogSchema.plugin(companyScopePlugin);
module.exports = mongoose.model('AuditLog', auditLogSchema);
