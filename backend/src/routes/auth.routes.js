const router = require('express').Router();
const config = require('../config');
const svc = require('../services/auth.service');
const otpSvc = require('../services/otp.service');
const { asyncHandler, ok, ApiError } = require('../utils');
const { validate, limiter, authenticate } = require('../middleware');
const v = require('../validators');

const COOKIE = 'aran_rt';
const cookieOpts = () => ({ httpOnly: true, secure: config.isProd, sameSite: config.isProd ? 'none' : 'lax', path: '/api/v1/auth', maxAge: config.jwt.refreshTtlDays * 864e5 });
// Refresh/logout rely on a cookie, so require a custom header (not sendable cross-site by forms) as CSRF defence.
const csrfGuard = (req, res, next) => (req.get('x-requested-with') === 'aran' ? next() : next(new ApiError(403, 'Missing CSRF header')));

const authLimiter = limiter(15 * 60 * 1000, 20, 'Too many attempts, try again in a few minutes');

// ---- Mobile OTP login (customers and delivery partners). Per-IP limiter here; per-number limits live in otp.service.
const phoneSchema = v.z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number');
const otpIpLimiter = limiter(15 * 60 * 1000, 30, 'Too many OTP requests from this device. Try again later.');
router.post('/otp/request', otpIpLimiter, validate(v.z.object({ phone: phoneSchema })), asyncHandler(async (req, res) => ok(res, await otpSvc.requestOtp(req.body.phone, req.ip))));
router.post('/otp/verify', otpIpLimiter, validate(v.z.object({ phone: phoneSchema, code: v.z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'), name: v.z.string().trim().min(2).max(80).optional(), referralCode: v.z.string().trim().max(12).optional() })), asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken, isNew, needsName } = await otpSvc.verifyOtp(req.body);
  res.cookie(COOKIE, refreshToken, cookieOpts());
  ok(res, { user: svc.publicUser(user), accessToken, isNew, needsName });
}));
router.post('/register', authLimiter, validate(v.auth.register), asyncHandler(async (req, res) => {
  const { user, activationToken } = await svc.register(req.body);
  ok(res, { user: svc.publicUser(user), activationToken }, null, 201);
}));

router.post('/activate', validate(v.z.object({ token: v.z.string().min(10) })), asyncHandler(async (req, res) => {
  ok(res, svc.publicUser(await svc.activate(req.body.token)));
}));

async function loginHandler(req, res, adminOnly) {
  const { user, accessToken, refreshToken } = await svc.login(req.body, { adminOnly });
  res.cookie(COOKIE, refreshToken, cookieOpts());
  ok(res, { user: svc.publicUser(user), accessToken });
}
router.post('/login', authLimiter, validate(v.auth.login), asyncHandler((req, res) => loginHandler(req, res, false)));
router.post('/admin/login', authLimiter, validate(v.auth.login), asyncHandler((req, res) => loginHandler(req, res, true)));

router.post('/refresh', csrfGuard, asyncHandler(async (req, res) => {
  try {
    const { user, accessToken, refreshToken } = await svc.refresh(req.cookies[COOKIE]);
    res.cookie(COOKIE, refreshToken, cookieOpts());
    ok(res, { user: svc.publicUser(user), accessToken });
  } catch (e) { res.clearCookie(COOKIE, cookieOpts()); throw e; }
}));

router.post('/logout', csrfGuard, asyncHandler(async (req, res) => {
  await svc.logout(req.cookies[COOKIE]);
  res.clearCookie(COOKIE, cookieOpts());
  ok(res, { loggedOut: true });
}));

router.post('/forgot-password', authLimiter, validate(v.auth.forgot), asyncHandler(async (req, res) => {
  const r = await svc.forgotPassword(req.body.email);
  ok(res, { message: 'If that email exists, a reset link has been sent.', ...r });
}));
router.post('/reset-password', authLimiter, validate(v.auth.reset), asyncHandler(async (req, res) => {
  await svc.resetPassword(req.body.token, req.body.password);
  ok(res, { reset: true });
}));
router.post('/change-password', authenticate, validate(v.auth.changePassword), asyncHandler(async (req, res) => {
  await svc.changePassword(req.user, req.body.currentPassword, req.body.newPassword);
  ok(res, { changed: true });
}));

module.exports = router;
