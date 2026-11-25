const config = require('../config');
const { getSmsConfig } = require('./settings.service');
const { ApiError, logger } = require('../utils');

const e164 = (phone) => `91${String(phone).replace(/\D/g, '').slice(-10)}`; // Indian mobile numbers

async function viaMsg91(c, phone, otp) {
  // MSG91 OTP API: the DLT-approved template must contain the ##OTP## variable.
  const url = new URL('https://control.msg91.com/api/v5/otp');
  url.search = new URLSearchParams({ template_id: c.msg91.templateId, mobile: e164(phone), authkey: c.msg91.authKey, otp }).toString();
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.type === 'error') throw new Error(json.message || `MSG91 HTTP ${res.status}`);
}

async function viaTwilio(c, phone, otp) {
  const { accountSid, authToken, from } = c.twilio;
  const body = new URLSearchParams({ To: `+${e164(phone)}`, [from.startsWith('MG') ? 'MessagingServiceSid' : 'From']: from, Body: `Your ARAN.co verification code is ${otp}. It expires in 5 minutes. Do not share it with anyone.` });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `Twilio HTTP ${res.status}`);
}

/**
 * Sends an OTP via the configured provider, falling back to the other provider if it is also configured
 * (so one gateway being down does not lock customers out). Returns { devOtp } only in non-production when no
 * provider is configured. In production an unconfigured provider is an error, never a silent success.
 */
async function sendOtp(phone, otp) {
  const c = await getSmsConfig();
  const ready = {
    msg91: () => c.msg91.authKey && c.msg91.templateId && viaMsg91(c, phone, otp),
    twilio: () => c.twilio.accountSid && c.twilio.authToken && c.twilio.from && viaTwilio(c, phone, otp),
  };
  const order = [c.provider, c.provider === 'msg91' ? 'twilio' : 'msg91'].filter((p) => ready[p]);
  let lastError = null, tried = 0;
  for (const p of order) {
    const attempt = ready[p]();
    if (!attempt) continue;
    tried += 1;
    try { await attempt; return {}; } catch (e) { lastError = e; logger.error('sms provider failed', { provider: p, error: e.message }); }
  }
  if (tried) fail(lastError);
  if (!config.isProd) { logger.info('DEV OTP (no SMS provider configured)', { phone, otp }); return { devOtp: otp }; }
  throw new ApiError(503, 'SMS login is not configured on this server. Please try again later.');
}function fail(e) { logger.error('sms send failed', { error: e.message }); throw new ApiError(502, 'We could not send the SMS right now. Please try again in a moment.'); }

module.exports = { sendOtp };
