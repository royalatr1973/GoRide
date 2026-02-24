const authService = require('../services/authService');

exports.register = async (req, res, next) => {
  try {
    const { email, phone, password, firstName, lastName, userType, companyName, licenseNumber, licenseExpiry } = req.body;

    const { user, accessToken, refreshToken } = await authService.register({
      email, phone, password, firstName, lastName, userType,
      companyName, licenseNumber, licenseExpiry
    });

    res.status(201).json({
      success: true,
      data: {
        user,
        accessToken,
        refreshToken,
        expiresIn: 900 // 15 minutes in seconds
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const { user, accessToken, refreshToken } = await authService.login({ email, password });

    res.json({
      success: true,
      data: {
        user,
        accessToken,
        refreshToken,
        expiresIn: 900
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const { accessToken } = await authService.refreshAccessToken(refreshToken);

    res.json({
      success: true,
      data: { accessToken, expiresIn: 900 }
    });
  } catch (error) {
    next(error);
  }
};

exports.logout = async (req, res, next) => {
  try {
    await authService.logout(req.user.userId);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

exports.getProfile = async (req, res, next) => {
  try {
    const { user, roleData } = await authService.getUserProfile(req.user.userId);
    res.json({ success: true, data: { user, roleData } });
  } catch (error) {
    next(error);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const User = require('../models/User');
    const allowedFields = ['profile.firstName', 'profile.lastName', 'profile.dateOfBirth',
      'profile.gender', 'profile.address', 'profile.city', 'profile.state', 'profile.pincode',
      'emergencyContact'];

    const updates = {};
    for (const field of allowedFields) {
      const keys = field.split('.');
      if (keys.length === 2) {
        if (req.body[keys[0]] && req.body[keys[0]][keys[1]] !== undefined) {
          updates[field] = req.body[keys[0]][keys[1]];
        }
      } else if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const user = await User.findByIdAndUpdate(req.user.userId, { $set: updates }, { new: true, runValidators: true });
    res.json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
};
