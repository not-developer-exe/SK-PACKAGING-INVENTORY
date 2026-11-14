const mongoose = require('mongoose');
const User = require('../models/User.model');
const Sequence = require('../models/Sequence.model');
const writeAuditLog = require('../utils/writeAuditLog');

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

exports.listUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: 1 }).lean();
    return res.json({ users });
  } catch (error) {
    console.error('[USERS] List failed:', error.message);
    return res.status(500).json({ message: 'Unable to load user accounts.' });
  }
};

exports.createUser = async (req, res) => {
  const { name, email, password, role = 'accountant' } = req.body || {};
  if (typeof name !== 'string' || name.trim().length < 2 ||
      typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      typeof password !== 'string' || password.length < 12 || password.length > 128 ||
      !['admin', 'accountant'].includes(role)) {
    return res.status(400).json({ message: 'Enter a name, valid email, password of at least 12 characters, and valid role.' });
  }
  try {
    const normalizedEmail = email.trim().toLowerCase();
    if (await User.exists({ email: normalizedEmail })) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role,
      isActive: true
    });
    await writeAuditLog(req, { action: 'user.created', entityType: 'User', entityId: user._id, entityLabel: user.email, summary: 'User account created: ' + user.email, metadata: { role } });
    return res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    console.error('[USERS] Create failed:', error.message);
    return res.status(400).json({ message: 'Unable to create user account.' });
  }
};

exports.updateUser = async (req, res) => {
  const { name, role, isActive, password } = req.body || {};
  if (name !== undefined && (typeof name !== 'string' || name.trim().length < 2)) {
    return res.status(400).json({ message: 'Name must contain at least 2 characters.' });
  }
  if (role !== undefined && !['admin', 'accountant'].includes(role)) {
    return res.status(400).json({ message: 'Invalid user role.' });
  }
  if (isActive !== undefined && typeof isActive !== 'boolean') {
    return res.status(400).json({ message: 'isActive must be a boolean.' });
  }
  if (password !== undefined && (typeof password !== 'string' || password.length < 12 || password.length > 128)) {
    return res.status(400).json({ message: 'New password must contain 12 to 128 characters.' });
  }

  const session = await mongoose.startSession();
  try {
    let updatedUser;
    await session.withTransaction(async () => {
      // A shared sequence write serializes admin-role changes so two requests cannot
      // concurrently remove the final active administrator.
      await Sequence.findOneAndUpdate(
        { _id: 'admin-management-lock' },
        [{ $set: { value: { $add: [{ $ifNull: ['$value', 0] }, 1] } } }],
        { new: true, upsert: true, session, updatePipeline: true }
      );

      const user = await User.findById(req.params.id).session(session);
      if (!user) throw Object.assign(new Error('User not found.'), { statusCode: 404 });

      const nextRole = role ?? user.role;
      const nextActive = isActive ?? user.isActive;
      const removesAdmin = user.role === 'admin' && user.isActive && (nextRole !== 'admin' || !nextActive);
      if (removesAdmin) {
        const activeAdmins = await User.countDocuments({ role: 'admin', isActive: true }).session(session);
        if (activeAdmins <= 1) throw Object.assign(new Error('The last active administrator cannot be demoted or deactivated.'), { statusCode: 409 });
      }
      if (String(user._id) === String(req.user._id) && !nextActive) {
        throw Object.assign(new Error('You cannot deactivate your own account.'), { statusCode: 400 });
      }

      const before = { name: user.name, role: user.role, isActive: user.isActive };
      if (name !== undefined) user.name = name.trim();
      if (role !== undefined) user.role = role;
      if (isActive !== undefined) user.isActive = isActive;
      if (password !== undefined) user.password = password;
      await user.save({ session });

      await writeAuditLog(req, {
        action: 'user.updated',
        entityType: 'User',
        entityId: user._id,
        entityLabel: user.email,
        summary: 'User account updated: ' + user.email,
        metadata: {
          before,
          after: { name: user.name, role: user.role, isActive: user.isActive },
          passwordReset: password !== undefined
        }
      }, session);
      updatedUser = user;
    });
    return res.json({ user: publicUser(updatedUser) });
  } catch (error) {
    console.error('[USERS] Update failed:', error.message);
    return res.status(error.statusCode || 400).json({ message: error.statusCode ? error.message : 'Unable to update user account.' });
  } finally {
    await session.endSession();
  }
};

module.exports = exports;
