const mongoose = require('mongoose');
const User = require('../models/User.model');

const connectDB = async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');

  const conn = await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000
  });
  console.info(`MongoDB connected: ${conn.connection.host}`);

  // Optional one-time bootstrap. Never ship a default credential.
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    const existingAdmin = await User.findOne({ email });
    if (!existingAdmin) {
      await User.create({
        name: process.env.ADMIN_NAME?.trim() || 'System Administrator',
        email,
        password,
        role: 'admin',
        isActive: true
      });
      console.info('Initial administrator account created from environment configuration.');
    }
  }

  return conn;
};

module.exports = connectDB;