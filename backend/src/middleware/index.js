const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { ZodError } = require('zod');
const config = require('../config');
const { ApiError, logger } = require('../utils');
const { User } = require('../models');

async function loadUser(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(h.slice(7), config.jwt.accessSecret);
    const user = await User.findById(payload.sub);
    return user && user.isActive ? user : null;
  } catch {
    return null;
  }
}

const authenticate = async (req, res, next) => {
  try {
    const user = await loadUser(req);
    if (!user) throw new ApiError(401, 'Authentication required');
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
};
const optionalAuth = async (req, res, next) => {
  try {
    req.user = await loadUser(req);
    next();
  } catch (e) {
    next(e);
  }
};

const ADMIN_ROLES = ['owner', 'manager', 'staff'];
const requireRoles = (...roles) => (req, res, next) =>
  req.user && roles.includes(req.user.role) ? next() : next(new ApiError(403, 'You do not have permission to perform this action'));
const adminOnly = requireRoles(...ADMIN_ROLES);
const managerUp = requireRoles('owner', 'manager');
const ownerOnly = requireRoles('owner');

// validate(schema, 'body'|'query'|'params')
const validate = (schema, source = 'body') => (req, res, next) => {
  const r = schema.safeParse(req[source]);
  if (!r.success) {
    return next(new ApiError(422, 'Validation failed', r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))));
  }
  if (source === 'query') Object.defineProperty(req, 'query', { value: r.data, writable: true, configurable: true });
  else req[source] = r.data;
  next();
};

// Strip keys starting with $ or containing '.' to block NoSQL operator injection.
function sanitize(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  for (const k of Object.keys(obj)) {
    if (k.startsWith('$') || k.includes('.')) delete obj[k];
    else sanitize(obj[k]);
  }
  return obj;
}
const sanitizeRequest = (req, res, next) => {
  sanitize(req.body);
  sanitize(req.params);
  sanitize(req.query);
  next();
};

const limiter = (windowMs, max, message = 'Too many requests, please try again later') =>
  rateLimit({ windowMs, max: config.isTest ? 10000 : max, standardHeaders: true, legacyHeaders: false, message: { success: false, error: { message } } });

const notFound = (req, res, next) => next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message;
  let details = err.details;
  if (err instanceof ZodError) { status = 422; message = 'Validation failed'; details = err.issues; }
  else if (err.name === 'ValidationError') { status = 422; details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message })); }
  else if (err.name === 'CastError') { status = 400; message = 'Invalid identifier'; }
  else if (err.code === 11000) { status = 409; message = `Duplicate value for ${Object.keys(err.keyPattern || {}).join(', ')}`; }
  else if (err.name === 'MulterError') status = 400;
  if (status >= 500) { logger.error(err.message, { stack: err.stack, path: req.originalUrl }); if (config.isProd) message = 'Internal server error'; }
  res.status(status).json({ success: false, error: { message, details } });
};

module.exports = { authenticate, optionalAuth, requireRoles, adminOnly, managerUp, ownerOnly, validate, sanitizeRequest, limiter, notFound, errorHandler, ADMIN_ROLES };
