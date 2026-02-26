const express = require('express');
const Joi = require('joi');
const jwt = require('jsonwebtoken');
const db = require('../db/connection');
const { generateOTP, sendOTPviaSMS } = require('../utils/otp');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/send-otp
router.post('/send-otp', async (req, res, next) => {
  try {
    const schema = Joi.object({
      phone: Joi.string().pattern(/^\+91\d{10}$/).required(),
      role: Joi.string().valid('passenger', 'driver', 'operator').required(),
    });
    const { phone, role } = await schema.validateAsync(req.body);

    const otp = generateOTP(4);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Invalidate previous OTPs for this phone
    await db('otp_codes')
      .where({ phone, role, is_used: false })
      .update({ is_used: true });

    await db('otp_codes').insert({ phone, code: otp, role, expires_at: expiresAt });

    await sendOTPviaSMS(phone, otp);

    res.json({ message: 'OTP sent successfully', phone });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res, next) => {
  try {
    const schema = Joi.object({
      phone: Joi.string().pattern(/^\+91\d{10}$/).required(),
      otp: Joi.string().length(4).required(),
      role: Joi.string().valid('passenger', 'driver', 'operator').required(),
    });
    const { phone, otp, role } = await schema.validateAsync(req.body);

    // Find valid OTP
    const otpRecord = await db('otp_codes')
      .where({ phone, code: otp, role, is_used: false })
      .where('expires_at', '>', new Date())
      .orderBy('created_at', 'desc')
      .first();

    if (!otpRecord) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // Mark OTP as used
    await db('otp_codes').where({ id: otpRecord.id }).update({ is_used: true });

    // Find or create user based on role
    const tableMap = { passenger: 'passengers', driver: 'drivers', operator: 'operators' };
    const table = tableMap[role];

    let user = await db(table).where({ phone }).first();
    if (!user) {
      const [newUser] = await db(table).insert({ phone }).returning('*');
      user = newUser;
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, phone: user.phone, role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '30d' },
    );

    res.json({
      message: 'Authenticated successfully',
      token,
      user: { id: user.id, name: user.name, phone: user.phone, role },
      is_new_user: !user.name,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/update-profile
router.post('/update-profile', authenticate, async (req, res, next) => {
  try {
    const schema = Joi.object({
      name: Joi.string().max(100),
      language_preference: Joi.string().valid('en', 'ta'),
    });
    const updates = await schema.validateAsync(req.body);

    const tableMap = { passenger: 'passengers', driver: 'drivers', operator: 'operators' };
    const table = tableMap[req.user.role];

    const [updated] = await db(table)
      .where({ id: req.user.id })
      .update(updates)
      .returning('*');

    res.json({ message: 'Profile updated', user: updated });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
