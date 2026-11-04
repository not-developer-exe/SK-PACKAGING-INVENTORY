require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User.model');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('Connected to DB. Creating Admin User...');
  
  // Wipe old test users just in case
  await User.deleteMany({ email: 'admin@skpackaging.com' });

  const admin = await User.create({
    name: 'Stark', // Or your actual name
    email: 'admin@skpackaging.com',
    password: 'password123', // You can change this later
    role: 'admin'
  });

  console.log('Admin created successfully:', admin.email);
  process.exit();
}).catch(err => console.error(err));