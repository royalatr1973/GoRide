const mongoose = require('mongoose');
const { DRIVER_STATUS, DOCUMENT_STATUS } = require('../../config/constants');

const driverSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  licenseNumber: {
    type: String,
    required: [true, 'License number is required'],
    unique: true,
    trim: true
  },
  licenseExpiry: {
    type: Date,
    required: [true, 'License expiry date is required']
  },
  operatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Operator'
  },
  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle'
  },
  documents: [{
    documentType: {
      type: String,
      enum: ['license', 'aadhar', 'pan', 'background_check', 'other']
    },
    documentUrl: String,
    expiryDate: Date,
    status: {
      type: String,
      enum: Object.values(DOCUMENT_STATUS),
      default: DOCUMENT_STATUS.PENDING
    },
    rejectionReason: String,
    uploadedAt: { type: Date, default: Date.now },
    verifiedAt: Date
  }],
  bankDetails: {
    accountHolderName: String,
    accountNumber: String,
    ifscCode: String,
    bankName: String
  },
  rating: {
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    totalRatings: { type: Number, default: 0 },
    completedRides: { type: Number, default: 0 }
  },
  status: {
    type: String,
    enum: Object.values(DRIVER_STATUS),
    default: DRIVER_STATUS.OFFLINE
  },
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  currentLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    },
    lastUpdated: Date
  },
  socketId: String
}, {
  timestamps: true
});

driverSchema.index({ currentLocation: '2dsphere' });
driverSchema.index({ userId: 1 });
driverSchema.index({ operatorId: 1 });
driverSchema.index({ status: 1 });
driverSchema.index({ isActive: 1, status: 1 });

module.exports = mongoose.model('Driver', driverSchema);
