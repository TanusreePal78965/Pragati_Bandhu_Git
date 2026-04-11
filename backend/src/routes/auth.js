const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// In-memory OTP store: Map<phone, { otp, expiresAt }>
// Simple and sufficient for single-instance Railway deployment.
// Replace with Redis if multi-instance scaling is ever needed.
const otpStore = new Map();

// Cleanup expired entries every 15 minutes to avoid memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [phone, record] of otpStore.entries()) {
    if (now > record.expiresAt) otpStore.delete(phone);
  }
}, 15 * 60 * 1000);

/**
 * POST /api/auth/send-otp
 * Body: { phone: "9876543210" }
 *
 * DEV MODE: OTP is returned in __dev_otp field and logged to console.
 * PROD: Remove __dev_otp from response and uncomment the Fast2SMS block below.
 */
router.post('/send-otp', (req, res) => {
  const { phone } = req.body;

  if (!phone || !/^\d{10}$/.test(phone)) {
    return res.status(400).json({ error: 'Valid 10-digit phone number required' });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore.set(phone, { otp, expiresAt: Date.now() + 10 * 60 * 1000 }); // 10-min TTL

  // ----- DEV MODE -----
  console.log(`[DEV] OTP for +91${phone}: ${otp}`);
  return res.json({ success: true, __dev_otp: otp });

  // ----- PROD: uncomment this block and remove the DEV block above -----
  // const axios = require('axios');
  // axios.get('https://www.fast2sms.com/dev/bulkV2', {
  //   params: {
  //     authorization: process.env.FAST2SMS_API_KEY,
  //     route: 'otp',
  //     variables_values: otp,
  //     flash: 0,
  //     numbers: phone,
  //   },
  // })
  //   .then(() => res.json({ success: true }))
  //   .catch((err) => {
  //     console.error('Fast2SMS error:', err.message);
  //     res.status(500).json({ error: 'Failed to send OTP' });
  //   });
});

/**
 * POST /api/auth/verify-otp
 * Body: { phone: "9876543210", otp: "123456" }
 * Response: { token } — JWT valid for 30 days
 */
router.post('/verify-otp', (req, res) => {
  const { phone, otp } = req.body;

  if (!phone || !otp) {
    return res.status(400).json({ error: 'Phone and OTP are required' });
  }

  const record = otpStore.get(phone);
  if (!record) {
    return res.status(400).json({ error: 'OTP not found. Please request a new one.' });
  }
  if (Date.now() > record.expiresAt) {
    otpStore.delete(phone);
    return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
  }
  if (record.otp !== otp) {
    return res.status(400).json({ error: 'Incorrect OTP. Please try again.' });
  }

  otpStore.delete(phone);

  const token = jwt.sign(
    { phone },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '30d' }
  );

  res.json({ token });
});

module.exports = router;
