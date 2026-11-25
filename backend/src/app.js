const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');
const config = require('./config');
const { sanitizeRequest, limiter, notFound, errorHandler } = require('./middleware');
const { logger } = require('./utils');

function createApp() {
  const app = express();
  app.set('trust proxy', true);
  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({
    origin: (o, cb) => {
      if (!o || config.clientOrigins.includes(o) || (o && (o.endsWith('.trycloudflare.com') || o.includes('localhost') || o.includes('127.0.0.1')))) {
        return cb(null, true);
      }
      return cb(new Error('CORS origin not allowed'));
    },
    credentials: true,
  }));

  app.use((req, res, next) => { // structured request log + latency
    const t = Date.now();
    res.on('finish', () => { if (!config.isTest) logger.info('req', { method: req.method, path: req.originalUrl.split('?')[0], status: res.statusCode, ms: Date.now() - t }); });
    next();
  });

  // Webhook route needs the untouched raw body, so skip JSON parsing for it.
  app.use(express.json({ limit: '200kb', type: (req) => !req.originalUrl.includes('/webhooks/') && /json/.test(req.headers['content-type'] || '') }));
  app.use(cookieParser());
  app.use((req, res, next) => (Buffer.isBuffer(req.body) ? next() : sanitizeRequest(req, res, next)));
  if (config.isProd) {
    app.use('/api', limiter(60 * 1000, 300));
  }

  const v1 = express.Router();
  v1.use(require('./routes/public.routes'));
  v1.use('/auth', require('./routes/auth.routes'));
  v1.use('/account', require('./routes/account.routes'));
  v1.use(require('./routes/order.routes'));
  v1.use('/admin', require('./routes/admin.routes'));
  v1.use('/delivery', require('./routes/delivery.routes'));
  v1.use('/geo', require('./routes/geo.routes'));
  app.use('/api/v1', v1);
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(require('./openapi')));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
