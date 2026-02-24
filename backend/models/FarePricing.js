const mongoose = require('mongoose');

const farePricingSchema = new mongoose.Schema({
  operatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Operator'
  },
  baseFare: { type: Number, required: true, default: 50 },
  perKmRate: { type: Number, required: true, default: 12 },
  perMinuteRate: { type: Number, required: true, default: 2 },
  minimumFare: { type: Number, required: true, default: 80 },
  surgeMultiplier: { type: Number, default: 1.0, min: 1.0, max: 5.0 },
  peakHours: [{
    day: { type: String, enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] },
    startTime: String, // "08:00"
    endTime: String,   // "10:00"
    multiplier: { type: Number, default: 1.5 }
  }],
  vehicleTypeRates: {
    sedan: { multiplier: { type: Number, default: 1.0 } },
    suv: { multiplier: { type: Number, default: 1.5 } },
    hatchback: { multiplier: { type: Number, default: 0.8 } },
    auto: { multiplier: { type: Number, default: 0.6 } }
  },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

farePricingSchema.index({ operatorId: 1, isActive: 1 });

module.exports = mongoose.model('FarePricing', farePricingSchema);
