const mongoose = require('mongoose');
const { RIDE_STATUS, PAYMENT_METHODS, PAYMENT_STATUS } = require('../../config/constants');

const rideSchema = new mongoose.Schema({
  passengerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver'
  },
  operatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Operator'
  },
  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle'
  },
  status: {
    type: String,
    enum: Object.values(RIDE_STATUS),
    default: RIDE_STATUS.REQUESTED
  },
  pickupLocation: {
    address: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  },
  dropLocation: {
    address: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  },
  // Route tracking (array of coordinates during ride)
  routePoints: [{
    latitude: Number,
    longitude: Number,
    timestamp: { type: Date, default: Date.now }
  }],
  distance: { type: Number, default: 0 }, // in km
  duration: { type: Number, default: 0 }, // in minutes
  estimatedDistance: Number,
  estimatedDuration: Number,
  fare: {
    baseFare: { type: Number, default: 0 },
    distanceFare: { type: Number, default: 0 },
    timeFare: { type: Number, default: 0 },
    surgeMultiplier: { type: Number, default: 1.0 },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    totalFare: { type: Number, default: 0 }
  },
  estimatedFare: { type: Number, default: 0 },
  vehicleType: { type: String, default: 'sedan' },
  // Timestamps for ride lifecycle
  requestedAt: { type: Date, default: Date.now },
  acceptedAt: Date,
  arrivingAt: Date,
  startedAt: Date,
  completedAt: Date,
  cancelledAt: Date,
  // Rating
  passengerRating: { score: Number, review: String, ratedAt: Date },
  driverRating: { score: Number, review: String, ratedAt: Date },
  // Payment
  paymentMethod: {
    type: String,
    enum: Object.values(PAYMENT_METHODS),
    default: PAYMENT_METHODS.CASH
  },
  paymentStatus: {
    type: String,
    enum: Object.values(PAYMENT_STATUS),
    default: PAYMENT_STATUS.PENDING
  },
  // Cancellation
  cancellationReason: String,
  cancelledBy: { type: String, enum: ['passenger', 'driver', 'system'] },
  specialRequests: String
}, {
  timestamps: true
});

rideSchema.index({ passengerId: 1, createdAt: -1 });
rideSchema.index({ driverId: 1, createdAt: -1 });
rideSchema.index({ operatorId: 1 });
rideSchema.index({ status: 1 });
rideSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Ride', rideSchema);
