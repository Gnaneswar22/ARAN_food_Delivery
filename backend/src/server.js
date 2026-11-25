const http = require('http');
const mongoose = require('mongoose');
const config = require('./config');
const { createApp } = require('./app');
const { initSockets } = require('./sockets');
const { logger } = require('./utils');
const orderSvc = require('./services/order.service');

async function start() {
  let uri = config.mongoUri;
  if (!uri) {
    if (config.isProd) throw new Error('MONGODB_URI is required in production');
    // Dev convenience only: in-memory MongoDB when no URI is configured (data is NOT persisted).
    const { MongoMemoryServer } = require('mongodb-memory-server');
    uri = (await MongoMemoryServer.create()).getUri('aran');
    logger.info('Using in-memory MongoDB (set MONGODB_URI to persist data)');
    process.env.SEED_ON_START = process.env.SEED_ON_START || '1';
  }
  if (uri.startsWith('mongodb+srv://') && !config.isProd && !config.isTest) {
    require('dns').setServers(['8.8.8.8', '1.1.1.1']);
  }
  await mongoose.connect(uri);
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  if (process.env.SEED_ON_START === '1') await require('./seed').seed();

  const server = http.createServer(createApp());
  initSockets(server);
  server.listen(config.port, () => logger.info(`ARAN API listening on :${config.port}`));

  // Release stock for unpaid online orders
  const timer = setInterval(() => orderSvc.expireUnpaid(config.paymentTimeoutMinutes).catch((e) => logger.error('expire job', { e: e.message })), 60000);
  const shutdown = async () => { clearInterval(timer); server.close(); await mongoose.disconnect(); process.exit(0); };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch((e) => { console.error(e); process.exit(1); });
