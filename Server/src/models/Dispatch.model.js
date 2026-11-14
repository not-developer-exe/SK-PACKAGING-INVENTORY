const mongoose = require('mongoose');

const dispatchSchema = new mongoose.Schema({
  challanNumber: { type: String, required: true, unique: true, trim: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true },
  dispatchDate: { type: Date, required: true, default: Date.now },
  
  boxes: [{
    boxId: { type: mongoose.Schema.Types.ObjectId, ref: 'FinishedBox', required: true },
    dispatchQuantity: { type: Number, required: true }
  }],
  
  vehicleNumber: { type: String, trim: true },
  driverName: { type: String, trim: true },
  
  status: { type: String, enum: ['dispatched', 'delivered'], default: 'dispatched' },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

dispatchSchema.index({ dispatchDate: -1, customerId: 1 });

module.exports = mongoose.model('Dispatch', dispatchSchema);