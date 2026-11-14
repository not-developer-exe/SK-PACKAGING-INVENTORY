const mongoose = require('mongoose');
const User = require('../models/User.model');

const connectDB = async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');

  const conn = await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000
  });
  console.info(`MongoDB connected: ${conn.connection.host}`);

  // ADMIN_EMAIL identifies the owner account. Existing accounts are promoted;
  // a new account is created only when ADMIN_PASSWORD is also configured.
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (email) {
    const ownerAccount = await User.findOne({ email });
    if (!ownerAccount && password) {
      await User.create({
        name: process.env.ADMIN_NAME?.trim() || 'System Administrator',
        email,
        password,
        role: 'admin',
        isActive: true
      });
      console.info('Initial administrator account created from environment configuration.');
    } else if (ownerAccount && (ownerAccount.role !== 'admin' || !ownerAccount.isActive)) {
      ownerAccount.role = 'admin';
      ownerAccount.isActive = true;
      await ownerAccount.save();
      console.info('Configured owner account promoted to active administrator.');
    }
  }

  return conn;
};

module.exports = connectDB;
