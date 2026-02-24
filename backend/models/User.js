const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { USER_TYPES } = require('../../config/constants');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6,
    select: false
  },
  userType: {
    type: String,
    enum: Object.values(USER_TYPES),
    required: [true, 'User type is required']
  },
  profile: {
    firstName: { type: String, required: [true, 'First name is required'], trim: true },
    lastName: { type: String, required: [true, 'Last name is required'], trim: true },
    profileImage: { type: String, default: '' },
    dateOfBirth: Date,
    gender: { type: String, enum: ['male', 'female', 'other'] },
    address: String,
    city: String,
    state: String,
    pincode: String
  },
  verification: {
    emailVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },
    emailToken: String,
    emailTokenExpiry: Date
  },
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String
  },
  refreshToken: { type: String, select: false },
  tokenVersion: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  lastLoginAt: Date
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Get full name
userSchema.methods.getFullName = function () {
  return `${this.profile.firstName} ${this.profile.lastName}`;
};

// Remove sensitive fields from JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.refreshToken;
  delete obj.tokenVersion;
  delete obj.verification?.emailToken;
  delete obj.verification?.emailTokenExpiry;
  return obj;
};

userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ userType: 1 });

module.exports = mongoose.model('User', userSchema);
