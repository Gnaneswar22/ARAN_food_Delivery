const crypto = require('crypto');

class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const ok = (res, data, meta, status = 200) => res.status(status).json({ success: true, data, ...(meta ? { meta } : {}) });

const slugify = (s) =>
  String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const randomToken = (n = 40) => crypto.randomBytes(n).toString('hex');

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pageParams(q) {
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// AES-256-GCM for secrets stored in the database (payment gateway keys).
const encKey = () => crypto.createHash('sha256').update(process.env.SETTINGS_ENCRYPTION_KEY || process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me').digest();
function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', encKey(), iv);
  const enc = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64')).join('.');
}
function decrypt(blob) {
  if (!blob) return '';
  try {
    const [iv, tag, enc] = blob.split('.').map((s) => Buffer.from(s, 'base64'));
    const d = crypto.createDecipheriv('aes-256-gcm', encKey(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
  } catch { return ''; } // key rotated / corrupt -> treated as not configured
}

const logger = {
  info: (msg, meta) => !process.env.JEST_WORKER_ID && console.log(JSON.stringify({ level: 'info', time: new Date().toISOString(), msg, ...meta })),
  error: (msg, meta) => !process.env.JEST_WORKER_ID && console.error(JSON.stringify({ level: 'error', time: new Date().toISOString(), msg, ...meta })),
};

module.exports = { encrypt, decrypt, ApiError, asyncHandler, ok, slugify, sha256, randomToken, haversineKm, pageParams, escapeRegex, logger };
