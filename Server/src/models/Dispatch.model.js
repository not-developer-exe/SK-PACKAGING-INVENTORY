const mongoose = require('mongoose');

const dispatchSchema = new mongoose.Schema({
  challanNumber: { type: String, required: true, unique: true, trim: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true },
  
  boxes: [{
    boxId: { type: mongoose.Schema.Types.ObjectId, ref: 'FinishedBox', required: true },
    dispatchQuantity: { type: Number, required: true }
  }],
  
  vehicleNumber: { type: String, trim: true },
  driverName: { type: String, trim: true },
  
  status: { type: String, enum: ['dispatched', 'delivered'], default: 'dispatched' },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Dispatch', dispatchSchema);