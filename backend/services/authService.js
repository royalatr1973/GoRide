const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const User = require('../models/User');
const Driver = require('../models/Driver');
const Operator = require('../models/Operator');
const { USER_TYPES } = require('../../config/constants');
const { BadRequestError, UnauthorizedError, ConflictError, NotFoundError } = require('../utils/errors');

/**
 * Generate access token
 */
function generateAccessToken(user) {
  return jwt.sign(
    { userId: user._id, email: user.email, userType: user.userType },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRE }
  );
}

/**
 * Generate refresh token
 */
function generateRefreshToken(user) {
  return jwt.sign(
    { userId: user._id, tokenVersion: user.tokenVersion },
    env.JWT_SECRET,
    { expiresIn: env.REFRESH_TOKEN_EXPIRE }
  );
}

/**
 * Register a new user
 */
async function register({ email, phone, password, firstName, lastName, userType, companyName, licenseNumber, licenseExpiry }) {
  // Check if user exists
  const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
  if (existingUser) {
    throw new ConflictError('User with this email or phone already exists');
  }

  // Create user
  const user = await User.create({
    email,
    phone,
    passwordHash: password,
    userType,
    profile: { firstName, lastName }
  });

  // Create role-specific record
  if (userType === USER_TYPES.DRIVER) {
    if (!licenseNumber || !licenseExpiry) {
      throw new BadRequestError('License number and expiry are required for drivers');
    }
    await Driver.create({ userId: user._id, licenseNumber, licenseExpiry });
  }

  if (userType === USER_TYPES.OPERATOR) {
    if (!companyName) {
      throw new BadRequestError('Company name is required for operators');
    }
    await Operator.create({ userId: user._id, companyName });
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  user.refreshToken = refreshToken;
  user.lastLoginAt = new Date();
  await user.save();

  return { user, accessToken, refreshToken };
}

/**
 * Login user
 */
async function login({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  if (!user.isActive) {
    throw new UnauthorizedError('Account is deactivated');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  user.refreshToken = refreshToken;
  user.lastLoginAt = new Date();
  await user.save();

  return { user, accessToken, refreshToken };
}

/**
 * Refresh access token
 */
async function refreshAccessToken(refreshToken) {
  if (!refreshToken) {
    throw new UnauthorizedError('No refresh token provided');
  }

  const decoded = jwt.verify(refreshToken, env.JWT_SECRET);
  const user = await User.findById(decoded.userId).select('+refreshToken +tokenVersion');

  if (!user || user.tokenVersion !== decoded.tokenVersion) {
    throw new UnauthorizedError('Invalid refresh token');
  }

  const newAccessToken = generateAccessToken(user);
  return { accessToken: newAccessToken };
}

/**
 * Logout user
 */
async function logout(userId) {
  await User.findByIdAndUpdate(userId, {
    refreshToken: null,
    $inc: { tokenVersion: 1 }
  });
}

/**
 * Get user profile with role-specific data
 */
async function getUserProfile(userId) {
  const user = await User.findById(userId);
  if (!user) throw new NotFoundError('User not found');

  let roleData = null;
  if (user.userType === USER_TYPES.DRIVER) {
    roleData = await Driver.findOne({ userId }).populate('vehicleId');
  } else if (user.userType === USER_TYPES.OPERATOR) {
    roleData = await Operator.findOne({ userId });
  }

  return { user, roleData };
}

module.exports = {
  register,
  login,
  refreshAccessToken,
  logout,
  getUserProfile,
  generateAccessToken,
  generateRefreshToken
};
