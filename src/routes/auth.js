const express = require('express');
const Joi = require('joi');
const jwt = require('jsonwebtoken');
const db = require('../db/connection');
const { generateOTP, sendOTPviaSMS } = require('../utils/otp');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// In-memory OTP store for dev mode (when DB is unavailable)
const devOTPStore = new Map();

async function isDBAvailable() {
  try {
    await db.raw('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

// POST /api/auth/send-otp
router.post('/send-otp', async (req, res, next) => {
  try {
    const schema = Joi.object({
      phone: Joi.string().pattern(/^\+91\d{10}$/).required(),
      role: Joi.string().valid('passenger', 'driver', 'operator').required(),
    });
    const { phone, role } = await schema.validateAsync(req.body);

    const otp = generateOTP(4);

    if (await isDBAvailable()) {
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      await db('otp_codes')
        .where({ phone, role, is_used: false })
        .update({ is_used: true });
      await db('otp_codes').insert({ phone, code: otp, role, expires_at: expiresAt });
    } else {
      // Dev fallback: store OTP in memory
      devOTPStore.set(`${phone}:${role}`, { code: otp, expires: Date.now() + 5 * 60 * 1000 });
    }

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

    let userId, userName;

    if (await isDBAvailable()) {
      const otpRecord = await db('otp_codes')
        .where({ phone, code: otp, role, is_used: false })
        .where('expires_at', '>', new Date())
        .orderBy('created_at', 'desc')
        .first();

      if (!otpRecord) {
        return res.status(400).json({ error: 'Invalid or expired OTP' });
      }

      await db('otp_codes').where({ id: otpRecord.id }).update({ is_used: true });

      const tableMap = { passenger: 'passengers', driver: 'drivers', operator: 'operators' };
      const table = tableMap[role];

      let user = await db(table).where({ phone }).first();
      if (!user) {
        const [newUser] = await db(table).insert({ phone }).returning('*');
        user = newUser;
      }
      userId = user.id;
      userName = user.name;
    } else {
      // Dev fallback: verify from in-memory store
      const key = `${phone}:${role}`;
      const stored = devOTPStore.get(key);
      if (!stored || stored.code !== otp || stored.expires < Date.now()) {
        return res.status(400).json({ error: 'Invalid or expired OTP' });
      }
      devOTPStore.delete(key);
      userId = 'dev-' + phone.slice(-4);
      userName = null;
    }

    const token = jwt.sign(
      { id: userId, phone, role },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '30d' },
    );

    res.json({
      message: 'Authenticated successfully',
      token,
      user: { id: userId, name: userName, phone, role },
      is_new_user: !userName,
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
