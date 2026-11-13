const mongoose = require('mongoose');

// A single transactional document serializes scrap-sale stock checks so two
// concurrent requests cannot both sell the same available waste.
const wasteInventorySchema = new mongoose.Schema({
  _id: { type: String, default: 'waste-stock' },
  revision: { type: Number, default: 0 }
}, { versionKey: false });

module.exports = mongoose.models.WasteInventory || mongoose.model('WasteInventory', wasteInventorySchema);
