const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 5000,
  SERVER_URL: process.env.SERVER_URL || 'http://localhost:5000',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5000',

  MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/goride',

  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  JWT_EXPIRE: process.env.JWT_EXPIRE || '15m',
  REFRESH_TOKEN_EXPIRE: process.env.REFRESH_TOKEN_EXPIRE || '7d',

  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || '',

  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT, 10) || 587,
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASSWORD: process.env.SMTP_PASSWORD || '',

  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100
};
