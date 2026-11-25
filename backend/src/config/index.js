require('dotenv').config();

const env = process.env;
const isProd = env.NODE_ENV === 'production';

const config = {
  isProd,
  isTest: env.NODE_ENV === 'test',
  port: Number(env.PORT) || 5000,
  mongoUri: env.MONGODB_URI || '',
  clientOrigins: (env.CLIENT_ORIGINS || 'http://localhost:5173').split(',').map((s) => s.trim()),
  jwt: {
    accessSecret: env.JWT_ACCESS_SECRET || (isProd ? '' : 'dev-access-secret-change-me'),
    refreshSecret: env.JWT_REFRESH_SECRET || (isProd ? '' : 'dev-refresh-secret-change-me'),
    accessTtl: env.JWT_ACCESS_TTL || '15m',
    refreshTtlDays: Number(env.JWT_REFRESH_TTL_DAYS) || 30,
  },
  razorpay: {
    keyId: env.RAZORPAY_KEY_ID || '',
    keySecret: env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: env.RAZORPAY_WEBHOOK_SECRET || '',
  },
  cloudinary: {
    cloudName: env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: env.CLOUDINARY_API_KEY || '',
    apiSecret: env.CLOUDINARY_API_SECRET || '',
  },
  smtp: { host: env.SMTP_HOST || '', port: Number(env.SMTP_PORT) || 587, user: env.SMTP_USER || '', pass: env.SMTP_PASS || '', from: env.SMTP_FROM || 'ARAN.co <no-reply@aran.com>' },
  vapid: { publicKey: env.VAPID_PUBLIC_KEY || '', privateKey: env.VAPID_PRIVATE_KEY || '', subject: env.VAPID_SUBJECT || 'mailto:support@aran.com' },
  whatsapp: { token: env.WHATSAPP_TOKEN || '', phoneId: env.WHATSAPP_PHONE_ID || '' },
  paymentTimeoutMinutes: Number(env.PAYMENT_TIMEOUT_MINUTES) || 15,
  clientUrl: env.CLIENT_URL || 'http://localhost:5173',
};

if (isProd) {
  for (const k of ['MONGODB_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'SETTINGS_ENCRYPTION_KEY']) {
    if (!env[k]) throw new Error(`Missing required env var ${k}`);
  }
}

module.exports = config;
