const crypto = require('crypto');

function generateOTP(length = 4) {
  const max = Math.pow(10, length);
  const min = Math.pow(10, length - 1);
  return String(crypto.randomInt(min, max));
}

async function sendOTPviaSMS(phone, otp) {
  // In production, integrate with MSG91 or Twilio
  // For development, log OTP to console
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEV] OTP for ${phone}: ${otp}`);
    return true;
  }

  // MSG91 integration placeholder
  // const axios = require('axios');
  // await axios.post('https://api.msg91.com/api/v5/otp', {
  //   authkey: process.env.MSG91_AUTH_KEY,
  //   template_id: process.env.MSG91_TEMPLATE_ID,
  //   mobile: phone.replace('+', ''),
  //   otp,
  // });
  return true;
}

module.exports = { generateOTP, sendOTPviaSMS };
