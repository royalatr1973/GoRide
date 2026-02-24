const mongoose = require('mongoose');
const { VEHICLE_TYPES, DOCUMENT_STATUS } = require('../../config/constants');

const vehicleSchema = new mongoose.Schema({
  operatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Operator',
    required: true
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver'
  },
  registrationNumber: {
    type: String,
    required: [true, 'Registration number is required'],
    unique: true,
    uppercase: true,
    trim: true
  },
  make: { type: String, required: true, trim: true },
  model: { type: String, required: true, trim: true },
  year: { type: Number, required: true },
  color: { type: String, required: true, trim: true },
  capacity: { type: Number, required: true, min: 1, max: 8 },
  vehicleType: {
    type: String,
    enum: Object.values(VEHICLE_TYPES),
    required: true
  },
  documents: [{
    documentType: {
      type: String,
      enum: ['registration', 'insurance', 'pollution', 'fitness']
    },
    documentUrl: String,
    expiryDate: Date,
    status: {
      type: String,
      enum: Object.values(DOCUMENT_STATUS),
      default: DOCUMENT_STATUS.PENDING
    }
  }],
  insuranceExpiry: Date,
  pollutionExpiry: Date,
  registrationExpiry: Date,
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

vehicleSchema.index({ operatorId: 1 });
vehicleSchema.index({ driverId: 1 });
vehicleSchema.index({ registrationNumber: 1 });

module.exports = mongoose.model('Vehicle', vehicleSchema);
