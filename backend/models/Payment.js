const mongoose = require('mongoose');
const { PAYMENT_METHODS, PAYMENT_STATUS } = require('../../config/constants');

const paymentSchema = new mongoose.Schema({
  rideId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ride',
    required: true
  },
  passengerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    required: true
  },
  operatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Operator'
  },
  amount: { type: Number, required: true },
  paymentMethod: {
    type: String,
    enum: Object.values(PAYMENT_METHODS),
    required: true
  },
  status: {
    type: String,
    enum: Object.values(PAYMENT_STATUS),
    default: PAYMENT_STATUS.PENDING
  },
  transactionId: { type: String, unique: true, sparse: true },
  commission: {
    operatorEarnings: { type: Number, default: 0 },
    platformFee: { type: Number, default: 0 },
    driverEarnings: { type: Number, default: 0 }
  },
  refundAmount: { type: Number, default: 0 },
  refundReason: String,
  completedAt: Date
}, {
  timestamps: true
});

paymentSchema.index({ rideId: 1 });
paymentSchema.index({ passengerId: 1, createdAt: -1 });
paymentSchema.index({ driverId: 1, createdAt: -1 });
paymentSchema.index({ status: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
