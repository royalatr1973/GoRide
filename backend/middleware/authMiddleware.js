const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const User = require('../models/User');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');

/**
 * Protect routes - require valid JWT
 */
const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw new UnauthorizedError('Not authorized, no token provided');
    }

    const decoded = jwt.verify(token, env.JWT_SECRET);

    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedError('User not found or inactive');
    }

    req.user = {
      userId: user._id,
      email: user.email,
      userType: user.userType,
      profile: user.profile
    };

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return next(error);
    }
    next(new UnauthorizedError('Not authorized, token invalid'));
  }
};

/**
 * Restrict to specific user roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Not authorized'));
    }
    if (!roles.includes(req.user.userType)) {
      return next(new ForbiddenError('You do not have permission to perform this action'));
    }
    next();
  };
};

module.exports = { protect, authorize };
