const mongoose = require("mongoose");
const User = require("../models/User.model");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    // Ensure default Admin exists
    const adminEmail = "admin@skpackaging.com";
    const existingAdmin = await User.findOne({ email: adminEmail });

    if (!existingAdmin) {
      await User.create({
        name: "Stark",
        email: adminEmail,
        password: "password123",
        role: "admin",
        isActive: true,
      });
      console.log(`🔐 Default Admin created: ${adminEmail} / password123`);
    } else {
      console.log(`🔐 Admin account verified in DB: ${adminEmail}`);
    }
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }

  // Ensure a default Supplier exists
  const Party = require("../models/Party.model");
  const defaultSupplier = await Party.findOne({ name: "Shree Paper Mills" });
  if (!defaultSupplier) {
    await Party.create({
      name: "Shree Paper Mills",
      partyType: "supplier",
      gstin: "23AABCS1429B1Z8",
      phone: "9827098270",
      address: "Industrial Area, Gwalior (M.P.)",
    });
    console.log("🏭 Default Supplier created: Shree Paper Mills");
  }
};

module.exports = connectDB;
