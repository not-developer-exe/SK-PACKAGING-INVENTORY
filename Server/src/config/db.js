const mongoose = require('mongoose');
const User = require('../models/User.model');

const connectDB = async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');

  const conn = await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000
  });
  console.info(`MongoDB connected: ${conn.connection.host}`);

  // ADMIN_EMAIL identifies the owner account. Inspect the raw collection so
  // legacy external-auth IDs cannot trigger Mongoose ObjectId/required-field
  // validation failures during API startup.
  const email = (process.env.ADMIN_EMAIL || 'official.additya.singh@gmail.com').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (email) {
    const ownerAccount = await User.collection.findOne({ email });
    if (!ownerAccount && password) {
      await User.create({
        name: process.env.ADMIN_NAME?.trim() || 'System Administrator',
        email,
        password,
        role: 'admin',
        isActive: true
      });
      console.info('Initial administrator account created from environment configuration.');
    } else if (ownerAccount) {
      const hasMongoObjectId = ownerAccount._id instanceof mongoose.Types.ObjectId;
      const hasPassword = typeof ownerAccount.password === 'string' && ownerAccount.password.length > 0;

      if (!hasMongoObjectId || !hasPassword) {
        console.warn(
          'Configured owner account uses an incompatible legacy user record. ' +
          'API startup will continue; run "npm run seed:admin" to safely migrate the owner login.'
        );
      } else if (ownerAccount.role !== 'admin' || !ownerAccount.isActive) {
        await User.collection.updateOne(
          { _id: ownerAccount._id },
          { $set: { role: 'admin', isActive: true } }
        );
        console.info('Configured owner account promoted to active administrator.');
      }
    }
  }

  return conn;
};

module.exports = connectDB;
