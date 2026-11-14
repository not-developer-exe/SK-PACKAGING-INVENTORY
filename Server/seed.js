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
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) throw new Error('Set a valid ADMIN_EMAIL.');
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
    throw new Error('Set ADMIN_PASSWORD to a unique password between 12 and 128 characters.');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  let admin = await User.findOne({ email });
  if (admin) {
    admin.role = 'admin';
    admin.isActive = true;
    if (configuredName && admin.name !== configuredName) admin.name = configuredName;
    await admin.save();
    console.log('Existing owner account promoted to active administrator:', admin.email);
  } else {
    admin = await User.create({ name, email, password, role: 'admin', isActive: true });
    console.log('Owner administrator account created:', admin.email);
  }
}

seedAdmin()
  .catch((error) => {
    console.error('[ADMIN SEED] Failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
