const crypto = require('crypto');
const config = require('../config');
const { Otp, User } = require('../models');
const { ApiError } = require('../utils');
const sms = require('./sms.service');
const authSvc = require('./auth.service');
const loyalty = require('./loyalty.service');

const TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;
const MAX_SENDS_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;
const OTP_ROLES = ['customer', 'delivery']; // staff/managers/owners use passwords only

const hash = (phone, code) => crypto.createHmac('sha256', config.jwt.refreshSecret).update(`${phone}:${code}`).digest('hex');
const safeEq = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); };

async function requestOtp(phone, ip) {
  const existing = await User.findOne({ phone });
  if (existing && !OTP_ROLES.includes(existing.role)) throw new ApiError(403, 'This number belongs to a staff account. Please sign in with your password.');
  if (existing && !existing.isActive) throw new ApiError(403, 'This account has been deactivated');

  const now = Date.now();
  const recent = await Otp.find({ phone, createdAt: { $gt: new Date(now - 3600e3) } }).sort({ createdAt: -1 });
  if (recent[0] && now - recent[0].sentAt.getTime() < RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((RESEND_COOLDOWN_MS - (now - recent[0].sentAt.getTime())) / 1000);
    throw new ApiError(429, `Please wait ${wait}s before requesting another code`, { retryAfter: wait });
  }
  if (recent.length >= MAX_SENDS_PER_HOUR) throw new ApiError(429, 'Too many codes requested for this number. Try again in an hour.');

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const sent = await sms.sendOtp(phone, code); // throws before we store anything if sending fails
  await Otp.deleteMany({ phone, expiresAt: { $lt: new Date() } });
  await Otp.create({ phone, codeHash: hash(phone, code), expiresAt: new Date(now + TTL_MS), sentAt: new Date(now), ip });
  return { expiresInSeconds: TTL_MS / 1000, resendInSeconds: RESEND_COOLDOWN_MS / 1000, isNewUser: !existing, ...sent };
}

async function verifyOtp({ phone, code, name, referralCode }) {
  const rec = await Otp.findOne({ phone }).sort({ createdAt: -1 });
  if (!rec || rec.expiresAt < new Date()) throw new ApiError(400, 'This code has expired. Please request a new one.');
  if (rec.attempts >= MAX_ATTEMPTS) { await rec.deleteOne(); throw new ApiError(429, 'Too many wrong attempts. Please request a new code.'); }
  if (!safeEq(rec.codeHash, hash(phone, code))) {
    rec.attempts += 1;
    await rec.save();
    throw new ApiError(400, `Incorrect code. ${MAX_ATTEMPTS - rec.attempts} attempt${MAX_ATTEMPTS - rec.attempts === 1 ? '' : 's'} left.`);
  }
  await Otp.deleteMany({ phone }); // single use

  let user = await User.findOne({ phone });
  let isNew = false;
  if (!user) { user = await User.create({ name: name?.trim() || 'Customer', phone, role: 'customer', isPhoneVerified: true }); isNew = true; await loyalty.applyReferral(user, referralCode); }
  else {
    if (!OTP_ROLES.includes(user.role)) throw new ApiError(403, 'Please sign in with your password');
    if (!user.isActive) throw new ApiError(403, 'This account has been deactivated');
    if (!user.isPhoneVerified) user.isPhoneVerified = true;
    if (name?.trim() && user.name === 'Customer') user.name = name.trim();
    await user.save();
  }
  const session = await authSvc.startSession(user);
  return { ...session, isNew, needsName: user.name === 'Customer' };
}

module.exports = { requestOtp, verifyOtp };
