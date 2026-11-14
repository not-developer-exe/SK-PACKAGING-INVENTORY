require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User.model');

async function seedAdmin() {
  const email = typeof process.env.ADMIN_EMAIL === 'string'
    ? process.env.ADMIN_EMAIL.trim().toLowerCase()
    : '';
  const password = process.env.ADMIN_PASSWORD;
  const configuredName = typeof process.env.ADMIN_NAME === 'string' && process.env.ADMIN_NAME.trim()
    ? process.env.ADMIN_NAME.trim()
    : '';
  const name = configuredName || 'System Administrator';

  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Set a valid ADMIN_EMAIL.');
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
    throw new Error('Set ADMIN_PASSWORD to a unique password between 12 and 128 characters.');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const existing = await User.collection.findOne({ email });

  if (existing) {
    const hasMongoObjectId = existing._id instanceof mongoose.Types.ObjectId;
    const hasPassword = typeof existing.password === 'string' && existing.password.length > 0;

    if (hasMongoObjectId && hasPassword) {
      const update = { role: 'admin', isActive: true };
      if (configuredName) update.name = configuredName;
      await User.collection.updateOne({ _id: existing._id }, { $set: update });
      console.log('Existing owner account promoted to active administrator:', email);
      return;
    }

    // Preserve the incompatible legacy document for audit/recovery, but move
    // its email aside so a normal MongoDB-backed password account can be made.
    const archiveEmail = `legacy-${Date.now()}@legacy.invalid`;
    const archived = await User.collection.updateOne(
      { _id: existing._id, email },
      {
        $set: {
          email: archiveEmail,
          legacyEmail: email,
          isActive: false,
          legacyAuthArchivedAt: new Date()
        }
      }
    );
    if (archived.modifiedCount !== 1) {
      throw new Error('Could not safely archive the incompatible owner record; no account was replaced.');
    }

    try {
      const admin = await User.create({
        name,
        email,
        password,
        role: 'admin',
        isActive: true
      });
      console.log('Legacy owner record preserved and a new administrator account created:', admin.email);
    } catch (error) {
      await User.collection.updateOne(
        { _id: existing._id, email: archiveEmail },
        {
          $set: {
            email,
            role: existing.role,
            isActive: existing.isActive
          },
          $unset: { legacyEmail: '', legacyAuthArchivedAt: '' }
        }
      );
      throw error;
    }
    return;
  }

  const admin = await User.create({ name, email, password, role: 'admin', isActive: true });
  console.log('Owner administrator account created:', admin.email);
}

seedAdmin()
  .catch((error) => {
    console.error('[ADMIN SEED] Failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
