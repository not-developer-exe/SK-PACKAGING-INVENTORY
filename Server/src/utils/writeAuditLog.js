const AuditLog = require('../models/AuditLog.model');

async function writeAuditLog(req, event, session) {
  const payload = {
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    entityLabel: event.entityLabel,
    actorId: req.user._id,
    actorName: req.user.name,
    actorRole: req.user.role,
    summary: event.summary,
    metadata: event.metadata || {}
  };
  const options = session ? { session } : {};
  const [entry] = await AuditLog.create([payload], options);
  return entry;
}

module.exports = writeAuditLog;
