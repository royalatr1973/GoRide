const mongoose = require('mongoose');

const operatorSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  companyName: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true
  },
  registrationNumber: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  gstNumber: { type: String, trim: true },
  contactPerson: String,
  operatingCity: { type: String, trim: true },
  bankDetails: {
    accountHolderName: String,
    accountNumber: String,
    ifscCode: String,
    bankName: String
  },
  subscription: {
    plan: { type: String, enum: ['free', 'basic', 'premium'], default: 'free' },
    startDate: Date,
    endDate: Date,
    monthlyFee: { type: Number, default: 0 }
  },
  stats: {
    totalVehicles: { type: Number, default: 0 },
    totalDrivers: { type: Number, default: 0 },
    totalRides: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 }
  },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

operatorSchema.index({ userId: 1 });

module.exports = mongoose.model('Operator', operatorSchema);
