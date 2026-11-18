const mongoose = require('mongoose');
const User = require('../models/User.model');

const connectDB = async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');

  const conn = await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000
  });
  const topology = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!topology.setName && topology.msg !== 'isdbgrid') {
    throw new Error('MongoDB replica set or sharded cluster required. Transactions are used for stock, invoices, payments and audit-safe workflows.');
  }
  console.info(`MongoDB connected: ${conn.connection.host} (transaction-capable topology)`);

  // Keep the two designated accounts aligned with the deployment configuration.
  // Use the raw collection so legacy external-auth records do not trigger Mongoose
  // schema validation while roles are being synchronized.
  const adminEmail = (process.env.ADMIN_EMAIL || 'official.additya.singh@gmail.com').trim().toLowerCase();
  const accountantEmail = (process.env.ACCOUNTANT_EMAIL || 'admin@skpackaging.com').trim().toLowerCase();
  if (adminEmail === accountantEmail) {
    throw new Error('ADMIN_EMAIL and ACCOUNTANT_EMAIL must be different accounts.');
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminAccount = await User.collection.findOne({ email: adminEmail });
  if (!adminAccount && adminPassword) {
    await User.create({
      name: process.env.ADMIN_NAME?.trim() || 'Aditya',
      email: adminEmail,
      password: adminPassword,
      role: 'admin',
      isActive: true
    });
    console.info('Initial administrator account created from environment configuration.');
  } else if (adminAccount) {
    const hasMongoObjectId = adminAccount._id instanceof mongoose.Types.ObjectId;
    const hasPassword = typeof adminAccount.password === 'string' && adminAccount.password.length > 0;

    if (!hasMongoObjectId || !hasPassword) {
      console.warn(
        'Configured administrator account uses an incompatible legacy user record. ' +
        'API startup will continue; run "npm run seed:admin" to safely migrate the owner login.'
      );
    } else if (adminAccount.role !== 'admin' || !adminAccount.isActive || adminAccount.name !== (process.env.ADMIN_NAME?.trim() || 'Aditya')) {
      await User.collection.updateOne(
        { _id: adminAccount._id },
        { $set: { role: 'admin', isActive: true, name: process.env.ADMIN_NAME?.trim() || 'Aditya' } }
      );
      console.info('Configured owner account promoted to active administrator.');
    }
  } else {
    console.warn('Administrator account was not found and ADMIN_PASSWORD is not configured; no new login was created.');
  }

  // No other account may retain administrator privileges, even if it was
  // previously promoted manually before the owner-only policy was introduced.
  await User.collection.updateMany(
    { email: { $ne: adminEmail }, role: { $ne: 'accountant' } },
    { $set: { role: 'accountant' } }
  );

  const accountantAccount = await User.collection.findOne({ email: accountantEmail });
  if (accountantAccount) {
    if (accountantAccount.role !== 'accountant' || !accountantAccount.isActive || accountantAccount.name !== (process.env.ACCOUNTANT_NAME?.trim() || 'Lakhan')) {
      await User.collection.updateOne(
        { _id: accountantAccount._id },
        { $set: { role: 'accountant', isActive: true, name: process.env.ACCOUNTANT_NAME?.trim() || 'Lakhan' } }
      );
      console.info('Configured accountant account set to active accountant role.');
    }
  } else {
    console.warn(`Configured accountant account was not found: ${accountantEmail}. Create it in User Management; no password or account was generated.`);
  }

  return conn;
};

module.exports = connectDB;
