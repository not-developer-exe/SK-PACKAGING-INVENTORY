const mongoose = require('mongoose');

const companyScopePlugin = require('../utils/companyScope');
const dispatchSchema = new mongoose.Schema({
  companyKey: { type: String, enum: ['sk-packaging', 'nsb-industrial-solutions'], default: 'sk-packaging', index: true },
  challanNumber: { type: String, required: true, unique: true, trim: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true },
  dispatchDate: { type: Date, required: true, default: Date.now },
  
  boxes: [{
    boxId: { type: mongoose.Schema.Types.ObjectId, ref: 'FinishedBox', required: true },
    dispatchQuantity: { type: Number, required: true }
  }],
  
  vehicleNumber: { type: String, trim: true },
  driverName: { type: String, trim: true },
  
  status: { type: String, enum: ['dispatched', 'delivered', 'cancelled'], default: 'dispatched' },
  cancelledAt: { type: Date },
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  cancellationReason: { type: String, trim: true, maxlength: 500 },
  deliveredAt: { type: Date },
  deliveredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deliveryNotes: { type: String, trim: true, maxlength: 500 },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

dispatchSchema.index({ dispatchDate: -1, customerId: 1 });

dispatchSchema.plugin(companyScopePlugin);

module.exports = mongoose.model('Dispatch', dispatchSchema);