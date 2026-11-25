const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { User, RefreshToken } = require('../models');
const { ApiError, sha256, randomToken } = require('../utils');
const notify = require('./notify.service');

const signAccess = (user) => jwt.sign({ sub: String(user._id), role: user.role }, config.jwt.accessSecret, { expiresIn: config.jwt.accessTtl });

async function issueRefresh(user, family = randomToken(8)) {
  const raw = randomToken(48);
  await RefreshToken.create({
    userId: user._id,
    tokenHash: sha256(raw),
    family,
    expiresAt: new Date(Date.now() + config.jwt.refreshTtlDays * 864e5),
  });
  return raw;
}

const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email, phone: u.phone, role: u.role, isEmailVerified: u.isEmailVerified, isPhoneVerified: u.isPhoneVerified, marketingConsent: u.marketingConsent });

/** Creates tokens for an already-authenticated user (used by OTP login). */
async function startSession(user) {
  return { user, accessToken: signAccess(user), refreshToken: await issueRefresh(user) };
}

async function register({ name, email, phone, password, marketingConsent }) {
  const exists = await User.findOne({ $or: [{ email }, ...(phone ? [{ phone }] : [])] });
  if (exists) throw new ApiError(409, 'An account with this email or phone already exists');
  const activationToken = randomToken(24);
  const user = await User.create({ name, email, phone, passwordHash: await bcrypt.hash(password, 12), activationToken: sha256(activationToken), marketingConsent: !!marketingConsent });
  notify.sendEmail(user.email, 'Welcome to ARAN.co', `Hi ${name}, activate your account: ${config.clientUrl}/activate?token=${activationToken}`).catch(() => {});
  return { user, activationToken: config.isProd ? undefined : activationToken };
}

async function activate(token) {
  const user = await User.findOneAndUpdate({ activationToken: sha256(token) }, { isEmailVerified: true, $unset: { activationToken: 1 } }, { returnDocument: 'after' });
  if (!user) throw new ApiError(400, 'Invalid or expired activation link');
  return user;
}

async function login({ identifier, password }, { adminOnly = false } = {}) {
  const user = await User.findOne({ $or: [{ email: identifier.toLowerCase() }, { phone: identifier }] }).select('+passwordHash');
  const valid = user?.passwordHash && (await bcrypt.compare(password, user.passwordHash));
  if (!valid) throw new ApiError(401, 'Invalid credentials');
  if (!user.isActive) throw new ApiError(403, 'This account has been deactivated');
  if (adminOnly && user.role === 'customer') throw new ApiError(403, 'Not an admin account');
  return { user, accessToken: signAccess(user), refreshToken: await issueRefresh(user) };
}

// Rotation with reuse detection: replaying a rotated token revokes the whole family.
async function refresh(raw) {
  if (!raw) throw new ApiError(401, 'No refresh token');
  const rec = await RefreshToken.findOne({ tokenHash: sha256(raw) });
  if (!rec) throw new ApiError(401, 'Invalid refresh token');
  if (rec.revokedAt) {
    await RefreshToken.updateMany({ family: rec.family, revokedAt: null }, { revokedAt: new Date() });
    throw new ApiError(401, 'Refresh token reuse detected');
  }
  if (rec.expiresAt < new Date()) throw new ApiError(401, 'Refresh token expired');
  const user = await User.findById(rec.userId);
  if (!user || !user.isActive) throw new ApiError(401, 'Account unavailable');
  const next = await issueRefresh(user, rec.family);
  rec.revokedAt = new Date();
  rec.replacedBy = sha256(next);
  await rec.save();
  return { user, accessToken: signAccess(user), refreshToken: next };
}

async function logout(raw) {
  if (!raw) return;
  const rec = await RefreshToken.findOne({ tokenHash: sha256(raw) });
  if (rec) await RefreshToken.updateMany({ family: rec.family, revokedAt: null }, { revokedAt: new Date() });
}

async function forgotPassword(email) {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return {}; // never reveal account existence
  const token = randomToken(24);
  user.resetTokenHash = sha256(token);
  user.resetTokenExpires = new Date(Date.now() + 30 * 60000);
  await user.save();
  notify.sendEmail(user.email, 'Reset your ARAN.co password', `Reset link (valid 30 min): ${config.clientUrl}/reset-password?token=${token}`).catch(() => {});
  return { resetToken: config.isProd ? undefined : token };
}

async function resetPassword(token, password) {
  const user = await User.findOne({ resetTokenHash: sha256(token), resetTokenExpires: { $gt: new Date() } }).select('+resetTokenHash +resetTokenExpires');
  if (!user) throw new ApiError(400, 'Invalid or expired reset token');
  user.passwordHash = await bcrypt.hash(password, 12);
  user.resetTokenHash = undefined;
  user.resetTokenExpires = undefined;
  await user.save();
  await RefreshToken.updateMany({ userId: user._id, revokedAt: null }, { revokedAt: new Date() });
}

async function changePassword(user, current, next) {
  const u = await User.findById(user._id).select('+passwordHash');
  if (!(await bcrypt.compare(current, u.passwordHash))) throw new ApiError(400, 'Current password is incorrect');
  u.passwordHash = await bcrypt.hash(next, 12);
  await u.save();
}

module.exports = { startSession, register, activate, login, refresh, logout, forgotPassword, resetPassword, changePassword, publicUser };
