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
      role !== 'accountant') {
    return res.status(400).json({ message: 'Enter a name, valid email, password of at least 12 characters. Only the owner account can be an administrator.' });
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
      role: 'accountant',
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
  if (role !== undefined && role !== 'accountant' && role !== 'admin') {
    return res.status(400).json({ message: 'Invalid user role.' });
  }
  if (role === 'admin') {
    return res.status(403).json({ message: 'Administrator access is reserved exclusively for the owner account.' });
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

      const ownerEmail = String(process.env.ADMIN_EMAIL || 'official.additya.singh@gmail.com').trim().toLowerCase();
      const isOwnerAccount = String(user.email).trim().toLowerCase() === ownerEmail;
      if (isOwnerAccount && ((role !== undefined && role !== 'admin') || isActive === false)) {
        throw Object.assign(new Error('The owner administrator account cannot be demoted or deactivated here.'), { statusCode: 403 });
      }
      if (!isOwnerAccount && role === 'admin') {
        throw Object.assign(new Error('Only the designated owner account can hold administrator privileges.'), { statusCode: 403 });
      }
      if (String(user._id) === String(req.user._id) && !(isActive ?? user.isActive)) {
        throw Object.assign(new Error('You cannot deactivate your own account.'), { statusCode: 400 });
      }

      const before = { name: user.name, role: user.role, isActive: user.isActive };
      if (name !== undefined) user.name = name.trim();
      user.role = isOwnerAccount ? 'admin' : 'accountant';
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
