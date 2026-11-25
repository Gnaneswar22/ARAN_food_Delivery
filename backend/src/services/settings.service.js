const { BusinessSettings } = require('../models');
const { ApiError, encrypt, decrypt } = require('../utils');
const config = require('../config');

let cache = null;
let cachedAt = 0;

async function getSettings(fresh = false) {
  if (!fresh && cache && Date.now() - cachedAt < 15000) return cache;
  let s = await BusinessSettings.findOne({ key: 'main' }).lean();
  if (!s) s = (await BusinessSettings.create({ key: 'main' })).toObject();
  cache = s;
  cachedAt = Date.now();
  return s;
}

async function updateSettings(patch) {
  const s = await BusinessSettings.findOne({ key: 'main' }) || new BusinessSettings({ key: 'main' });
  for (const k of ['brand', 'stall', 'timings', 'delivery', 'pickup', 'tax', 'loyalty', 'notifications']) {
    if (patch[k]) s.set(k, { ...(s.get(k)?.toObject?.() || s.get(k) || {}), ...patch[k] });
  }
  if (typeof patch.guestCheckout === 'boolean') s.guestCheckout = patch.guestCheckout;
  await s.save();
  cache = null;
  return s.toObject();
}

const TZ = process.env.BUSINESS_TZ || 'Asia/Kolkata';
function nowInBusinessTz(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t).value;
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return { dow, minutes: Number(get('hour')) % 24 * 60 + Number(get('minute')) };
}
const toMin = (hhmm) => { const [h, m] = String(hhmm || '0:0').split(':').map(Number); return h * 60 + (m || 0); };

function storeStatus(s, date = new Date()) {
  const t = s.timings || {};
  if (t.acceptingOrders === false) return { open: false, reason: 'We are not accepting orders right now.' };
  if (t.temporaryClosure) return { open: false, reason: 'ARAN is temporarily closed.' };
  const { dow, minutes } = nowInBusinessTz(date);
  if ((t.weeklyHolidays || []).includes(dow)) return { open: false, reason: 'ARAN is closed today.' };
  const o = toMin(t.open), c = toMin(t.close);
  const inside = o <= c ? minutes >= o && minutes < c : minutes >= o || minutes < c;
  if (!inside) return { open: false, reason: `We are open ${t.open} – ${t.close}.` };
  return { open: true };
}

async function assertOpen() {
  const st = storeStatus(await getSettings());
  if (!st.open) throw new ApiError(409, st.reason);
}

/** Effective payment configuration: admin-saved values override environment defaults. Includes secrets: server-side only. */
async function getPaymentConfig() {
  const s = await getSettings();
  const p = s.payments || {};
  const rz = p.razorpay || {};
  const keyId = rz.keyId || config.razorpay.keyId;
  const keySecret = decrypt(rz.keySecretEnc) || config.razorpay.keySecret;
  const webhookSecret = decrypt(rz.webhookSecretEnc) || config.razorpay.webhookSecret;
  const configured = !!(keyId && keySecret);
  return { keyId, keySecret, webhookSecret, configured, onlineEnabled: p.onlineEnabled !== false && configured, onlineToggle: p.onlineEnabled !== false, codEnabled: p.codEnabled !== false };
}

/** Admin view: never returns secrets, only whether they are set. */
async function getPaymentAdminView() {
  const c = await getPaymentConfig();
  return { onlineEnabled: c.onlineToggle, codEnabled: c.codEnabled, razorpay: { keyId: c.keyId || '', keySecretSet: !!c.keySecret, webhookSecretSet: !!c.webhookSecret, configured: c.configured } };
}

async function savePaymentSettings({ onlineEnabled, codEnabled, razorpay = {} }) {
  const s = (await BusinessSettings.findOne({ key: 'main' })) || new BusinessSettings({ key: 'main' });
  s.payments ||= {};
  if (typeof onlineEnabled === 'boolean') s.payments.onlineEnabled = onlineEnabled;
  if (typeof codEnabled === 'boolean') s.payments.codEnabled = codEnabled;
  if (s.payments.onlineEnabled === false && s.payments.codEnabled === false) throw new ApiError(422, 'Enable at least one payment method');
  s.payments.razorpay ||= {};
  if (typeof razorpay.keyId === 'string') s.payments.razorpay.keyId = razorpay.keyId.trim();
  if (razorpay.keySecret) s.payments.razorpay.keySecretEnc = encrypt(razorpay.keySecret.trim()); // blank = keep existing
  if (razorpay.webhookSecret) s.payments.razorpay.webhookSecretEnc = encrypt(razorpay.webhookSecret.trim());
  if (razorpay.clearSecrets) { s.payments.razorpay.keySecretEnc = undefined; s.payments.razorpay.webhookSecretEnc = undefined; }
  s.markModified('payments');
  await s.save();
  cache = null;
  return getPaymentAdminView();
}

/** Effective SMS configuration (admin-saved values override environment). Server-side only: includes secrets. */
async function getSmsConfig() {
  const s = await getSettings();
  const d = s.sms || {};
  const provider = (d.provider && d.provider !== 'none' ? d.provider : process.env.SMS_PROVIDER) || 'none';
  return {
    provider,
    msg91: { authKey: decrypt(d.msg91?.authKeyEnc) || process.env.MSG91_AUTH_KEY || '', templateId: d.msg91?.templateId || process.env.MSG91_TEMPLATE_ID || '' },
    twilio: { accountSid: d.twilio?.accountSid || process.env.TWILIO_ACCOUNT_SID || '', authToken: decrypt(d.twilio?.authTokenEnc) || process.env.TWILIO_AUTH_TOKEN || '', from: d.twilio?.from || process.env.TWILIO_FROM || '' },
  };
}
async function getSmsAdminView() {
  const c = await getSmsConfig();
  return { provider: c.provider, msg91: { templateId: c.msg91.templateId, authKeySet: !!c.msg91.authKey }, twilio: { accountSid: c.twilio.accountSid, from: c.twilio.from, authTokenSet: !!c.twilio.authToken } };
}
async function saveSmsSettings({ provider, msg91 = {}, twilio = {} }) {
  const s = (await BusinessSettings.findOne({ key: 'main' })) || new BusinessSettings({ key: 'main' });
  s.sms ||= {};
  if (provider) s.sms.provider = provider;
  s.sms.msg91 ||= {}; s.sms.twilio ||= {};
  if (typeof msg91.templateId === 'string') s.sms.msg91.templateId = msg91.templateId.trim();
  if (msg91.authKey) s.sms.msg91.authKeyEnc = encrypt(msg91.authKey.trim());
  if (typeof twilio.accountSid === 'string') s.sms.twilio.accountSid = twilio.accountSid.trim();
  if (typeof twilio.from === 'string') s.sms.twilio.from = twilio.from.trim();
  if (twilio.authToken) s.sms.twilio.authTokenEnc = encrypt(twilio.authToken.trim());
  s.markModified('sms');
  await s.save();
  cache = null;
  return getSmsAdminView();
}
// Public subset (no internal flags, never any secrets)
async function publicSettings() {
  const s = await getSettings();
  const { _id, __v, createdAt, updatedAt, key, payments, sms, ...rest } = s;
  const pc = await getPaymentConfig();
  return { ...rest, payments: { onlineEnabled: pc.onlineEnabled, codEnabled: pc.codEnabled }, status: storeStatus(s) };
}

module.exports = { getSettings, updateSettings, storeStatus, assertOpen, publicSettings, getPaymentConfig, getPaymentAdminView, savePaymentSettings, getSmsConfig, getSmsAdminView, saveSmsSettings };
