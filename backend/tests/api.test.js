process.env.NODE_ENV = 'test';
process.env.RAZORPAY_KEY_ID = 'rzp_test_x';
process.env.RAZORPAY_KEY_SECRET = 'secret_x';
process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_x';
process.env.BUSINESS_TZ = 'Asia/Kolkata';

const crypto = require('crypto');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createApp } = require('../src/app');
const models = require('../src/models');
const { seed } = require('../src/seed');
const settingsSvc = require('../src/services/settings.service');

let mongod, app, adminToken, custToken, burger, limited;
const hmac = (s, d) => crypto.createHmac('sha256', s).update(d).digest('hex');
const auth = (t) => ({ Authorization: `Bearer ${t}` });
const customer = { name: 'Test User', phone: '9876543210', email: 'c@test.com' };
const addr = { line1: '1 Main St', city: 'Pune', pincode: '411001' };

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri('t'));
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  await seed();
  app = createApp();
  // open all day, known delivery rules
  await settingsSvc.updateSettings({ timings: { open: '00:00', close: '23:59', acceptingOrders: true, temporaryClosure: false, weeklyHolidays: [] }, delivery: { pincodes: ['411001'], feePaise: 4000, minOrderPaise: 10000, freeDeliveryThresholdPaise: 100000 }, guestCheckout: true });
  adminToken = (await request(app).post('/api/v1/auth/admin/login').send({ identifier: 'owner@aran.local', password: 'Aran@12345' })).body.data.accessToken;
  burger = await models.Product.findOne({ name: 'Classic ARAN Burger' });
  limited = await models.Product.findOne({ name: 'Double Smash' });
  await models.Inventory.updateOne({ productId: limited._id }, { availableQuantity: 3 });
  global.fetch = vi.fn(async (url) => ({ ok: true, json: async () => (String(url).includes('/refund') ? { id: 'rfnd_1' } : { id: 'order_' + Math.random().toString(36).slice(2), amount: 0, currency: 'INR' }) }));
});
afterAll(async () => { await mongoose.disconnect(); await mongod.stop(); });

const place = (over = {}, token) => {
  const r = request(app).post('/api/v1/orders').send({ items: [{ productId: String(burger._id), quantity: 1 }], orderType: 'delivery', address: addr, customer, paymentMethod: 'cod', ...over });
  return token ? r.set(auth(token)) : r;
};

describe('auth', () => {
  test('register, login, refresh rotation, reuse detection', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send({ name: 'Cust One', email: 'cust@test.com', phone: '9123456780', password: 'Passw0rdX' });
    expect(reg.status).toBe(201);
    const login = await request(app).post('/api/v1/auth/login').send({ identifier: 'cust@test.com', password: 'Passw0rdX' });
    expect(login.status).toBe(200);
    custToken = login.body.data.accessToken;
    const cookie = login.headers['set-cookie'][0].split(';')[0];
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie)).status).toBe(403); // no CSRF header
    const r1 = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie).set('X-Requested-With', 'aran');
    expect(r1.status).toBe(200);
    const replay = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie).set('X-Requested-With', 'aran');
    expect(replay.status).toBe(401);
    const newCookie = r1.headers['set-cookie'][0].split(';')[0];
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', newCookie).set('X-Requested-With', 'aran')).status).toBe(401); // family revoked
  });
  test('rejects bad credentials and weak passwords', async () => {
    expect((await request(app).post('/api/v1/auth/login').send({ identifier: 'cust@test.com', password: 'nope' })).status).toBe(401);
    expect((await request(app).post('/api/v1/auth/register').send({ name: 'X Y', email: 'a@b.com', password: 'short' })).status).toBe(422);
  });
  test('customers and anonymous users cannot reach admin APIs', async () => {
    expect((await request(app).get('/api/v1/admin/orders')).status).toBe(401);
    expect((await request(app).get('/api/v1/admin/orders').set(auth(custToken))).status).toBe(403);
    expect((await request(app).post('/api/v1/auth/admin/login').send({ identifier: 'cust@test.com', password: 'Passw0rdX' })).status).toBe(403);
  });
});

describe('catalog & cart', () => {
  test('browse, search, filter', async () => {
    const all = await request(app).get('/api/v1/products');
    expect(all.body.data.length).toBeGreaterThan(5);
    expect((await request(app).get('/api/v1/products?q=pizza')).body.data).toHaveLength(0);
    expect((await request(app).get('/api/v1/products?category=pizzas')).body.data).toHaveLength(3);
    expect((await request(app).get('/api/v1/products?foodType=veg&sort=price_asc')).body.data[0].foodType).toBe('veg');
    expect((await request(app).get('/api/v1/products/classic-aran-burger')).body.data.name).toBe('Classic ARAN Burger');
  });
  test('quote ignores client prices, applies coupon + tax + delivery fee', async () => {
    const r = await request(app).post('/api/v1/cart/quote').send({ items: [{ productId: String(burger._id), quantity: 2 }], orderType: 'delivery', address: addr, couponCode: 'welcome10' });
    const p = r.body.data.pricing;
    expect(p.subtotalPaise).toBe(49800);
    expect(p.discountPaise).toBe(4980);
    expect(p.deliveryFeePaise).toBe(4000);
    expect(p.totalPaise).toBe(49800 - 4980 + Math.round((49800 - 4980) * 0.05) + 4000);
  });
  test('delivery outside service area is blocked, pickup is allowed', async () => {
    expect((await place({ address: { ...addr, pincode: '999999' } })).status).toBe(422);
    expect((await place({ orderType: 'pickup', address: undefined })).status).toBe(201);
  });
  test('minimum order enforced', async () => {
    const cheap = await models.Product.findOne({ name: 'Fresh Lime Soda' });
    expect((await place({ items: [{ productId: String(cheap._id), quantity: 1 }] })).status).toBe(422);
  });
  test('invalid coupon rejected at checkout', async () => {
    expect((await place({ couponCode: 'NOPE' })).status).toBe(400);
  });
});

describe('orders', () => {
  test('COD order flows through valid transitions, collection and stock deduction', async () => {
    const o = (await place({ items: [{ productId: String(limited._id), quantity: 1 }] }, custToken)).body.data;
    expect(o.orderStatus).toBe('placed');
    expect(o.paymentStatus).toBe('unpaid');
    expect((await models.Inventory.findOne({ productId: limited._id })).reservedQuantity).toBe(1);
    const st = (status, extra) => request(app).post(`/api/v1/admin/orders/${o._id}/status`).set(auth(adminToken)).send({ status, ...extra });
    expect((await st('delivered')).status).toBe(409); // invalid jump
    for (const s of ['confirmed', 'preparing', 'ready']) expect((await st(s)).status).toBe(200);
    expect((await st('out_for_delivery')).status).toBe(422); // no partner
    const partner = (await request(app).post('/api/v1/admin/delivery/partners').set(auth(adminToken)).send({ name: 'Ravi', phone: '9000000001' })).body.data;
    expect((await request(app).post(`/api/v1/admin/orders/${o._id}/assign`).set(auth(adminToken)).send({ partnerId: partner._id })).status).toBe(200);
    expect((await st('out_for_delivery')).status).toBe(200);
    expect((await st('delivered')).status).toBe(200);
    const inv = await models.Inventory.findOne({ productId: limited._id });
    expect(inv.reservedQuantity).toBe(0);
    expect(inv.availableQuantity).toBe(2);
    const col = await request(app).post(`/api/v1/admin/orders/${o._id}/cod-collect`).set(auth(adminToken)).send({});
    expect(col.body.data.paymentStatus).toBe('paid');
    const mine = await request(app).get(`/api/v1/orders/${o._id}`).set(auth(custToken));
    expect(mine.body.data.statusHistory.length).toBeGreaterThan(5);
  });

  test('idempotency key prevents duplicate orders', async () => {
    const key = 'idem-key-12345';
    const a = await place({ idempotencyKey: key }, custToken);
    const b = await place({ idempotencyKey: key }, custToken);
    expect(a.status).toBe(201);
    expect(b.status).toBe(200);
    expect(b.body.data._id).toBe(a.body.data._id);
  });

  test('simultaneous orders cannot oversell limited stock', async () => {
    await models.Inventory.updateOne({ productId: limited._id }, { availableQuantity: 3, reservedQuantity: 0 });
    const results = await Promise.all(Array.from({ length: 6 }, () => place({ items: [{ productId: String(limited._id), quantity: 1 }] })));
    expect(results.filter((r) => r.status === 201)).toHaveLength(3);
    expect(results.filter((r) => r.status === 409)).toHaveLength(3);
    const inv = await models.Inventory.findOne({ productId: limited._id });
    expect(inv.availableQuantity).toBe(0);
  });

  test('cancellation releases stock and requires reason', async () => {
    await models.Inventory.updateOne({ productId: limited._id }, { availableQuantity: 5, reservedQuantity: 0 });
    const o = (await place({ items: [{ productId: String(limited._id), quantity: 2 }] })).body.data;
    expect((await request(app).post(`/api/v1/admin/orders/${o._id}/status`).set(auth(adminToken)).send({ status: 'cancelled' })).status).toBe(422);
    expect((await request(app).post(`/api/v1/admin/orders/${o._id}/status`).set(auth(adminToken)).send({ status: 'cancelled', reason: 'Out of ingredients' })).status).toBe(200);
    expect((await models.Inventory.findOne({ productId: limited._id })).availableQuantity).toBe(5);
  });

  test('guests can track only with their guest token', async () => {
    const o = (await place()).body.data;
    expect(o.guestToken).toBeTruthy();
    expect((await request(app).get(`/api/v1/orders/${o._id}`)).status).toBe(404);
    expect((await request(app).get(`/api/v1/orders/${o._id}`).set('x-guest-token', o.guestToken)).status).toBe(200);
  });
});

describe('online payments', () => {
  let order, rzpOrderId;
  beforeAll(async () => {
    order = (await place({ paymentMethod: 'online' }, custToken)).body.data;
    global.fetch.mockImplementation(async (url) => (String(url).includes('/refund') ? { ok: true, json: async () => ({ id: 'rfnd_1' }) } : { ok: true, json: async () => ({ id: 'order_RZP1', amount: order.pricingSnapshot.totalPaise, currency: 'INR' }) }));
  });
  test('order awaits payment; failed signature is rejected', async () => {
    expect(order.orderStatus).toBe('pending_payment');
    const p = await request(app).post(`/api/v1/orders/${order._id}/payment`).set(auth(custToken));
    expect(p.status).toBe(200);
    rzpOrderId = p.body.data.razorpayOrderId;
    const bad = await request(app).post(`/api/v1/orders/${order._id}/payment/verify`).set(auth(custToken)).send({ razorpay_order_id: rzpOrderId, razorpay_payment_id: 'pay_1', razorpay_signature: 'deadbeef' });
    expect(bad.status).toBe(400);
    expect((await models.Order.findById(order._id)).orderStatus).toBe('pending_payment');
  });
  test('valid signature confirms once; duplicate callback and webhook are idempotent', async () => {
    const sig = hmac('secret_x', `${rzpOrderId}|pay_1`);
    const body = { razorpay_order_id: rzpOrderId, razorpay_payment_id: 'pay_1', razorpay_signature: sig };
    const a = await request(app).post(`/api/v1/orders/${order._id}/payment/verify`).set(auth(custToken)).send(body);
    expect(a.body.data.orderStatus).toBe('placed');
    const b = await request(app).post(`/api/v1/orders/${order._id}/payment/verify`).set(auth(custToken)).send(body);
    expect(b.body.data.duplicate).toBe(true);
    const raw = JSON.stringify({ id: 'evt_1', event: 'payment.captured', payload: { payment: { entity: { id: 'pay_1', order_id: rzpOrderId, amount: order.pricingSnapshot.totalPaise } } } });
    const wh = (s) => request(app).post('/api/v1/webhooks/razorpay').set('Content-Type', 'application/json').set('x-razorpay-signature', s).send(raw);
    expect((await wh('bad')).status).toBe(400);
    expect((await wh(hmac('whsec_x', raw))).status).toBe(200);
    expect((await wh(hmac('whsec_x', raw))).status).toBe(200);
    expect(await models.Payment.countDocuments({ orderId: order._id })).toBe(1);
    const o = await models.Order.findById(order._id);
    expect(o.paymentStatus).toBe('paid');
    expect(o.statusHistory.filter((h) => h.status === 'placed')).toHaveLength(1);
  });
  test('cancelling a paid order triggers refund', async () => {
    const r = await request(app).post(`/api/v1/admin/orders/${order._id}/status`).set(auth(adminToken)).send({ status: 'cancelled', reason: 'Kitchen closed' });
    expect(r.status).toBe(200);
    const o = await models.Order.findById(order._id);
    expect(o.paymentStatus).toBe('refunded');
    expect(o.refundedPaise).toBe(o.pricingSnapshot.totalPaise);
  });
  test('unpaid online orders expire and release stock', async () => {
    await models.Inventory.updateOne({ productId: limited._id }, { availableQuantity: 4, reservedQuantity: 0 });
    const o = (await place({ paymentMethod: 'online', items: [{ productId: String(limited._id), quantity: 2 }] })).body.data;
    expect((await models.Inventory.findOne({ productId: limited._id })).availableQuantity).toBe(2);
    await models.Order.collection.updateOne({ _id: new mongoose.Types.ObjectId(o._id) }, { $set: { createdAt: new Date(Date.now() - 3600e3) } });
    await require('../src/services/order.service').expireUnpaid(15);
    expect((await models.Inventory.findOne({ productId: limited._id })).availableQuantity).toBe(4);
    expect((await models.Order.findById(o._id)).orderStatus).toBe('cancelled');
  });
});

describe('payment gateway settings', () => {
  test('owner saves keys; secrets are encrypted and never returned; non-owners blocked', async () => {
    const mgr = await models.User.create({ name: 'Mgr', email: 'm@test.com', role: 'manager', passwordHash: await require('bcryptjs').hash('Passw0rdX', 4) });
    const mt = (await request(app).post('/api/v1/auth/admin/login').send({ identifier: 'm@test.com', password: 'Passw0rdX' })).body.data.accessToken;
    expect((await request(app).get('/api/v1/admin/payment-settings').set(auth(mt))).status).toBe(403);
    const put = await request(app).put('/api/v1/admin/payment-settings').set(auth(adminToken)).send({ razorpay: { keyId: 'rzp_test_abc123', keySecret: 'super-secret-value', webhookSecret: 'wh-secret-value' } });
    expect(put.status).toBe(200);
    expect(JSON.stringify(put.body)).not.toContain('super-secret-value');
    expect(put.body.data.razorpay).toMatchObject({ keyId: 'rzp_test_abc123', keySecretSet: true, webhookSecretSet: true });
    const raw = await models.BusinessSettings.findOne({ key: 'main' }).lean();
    expect(raw.payments.razorpay.keySecretEnc).toBeTruthy();
    expect(raw.payments.razorpay.keySecretEnc).not.toContain('super-secret-value');
    expect(JSON.stringify((await request(app).get('/api/v1/settings')).body)).not.toMatch(/Enc|super-secret/);
    expect(JSON.stringify((await request(app).get('/api/v1/admin/settings').set(auth(adminToken))).body)).not.toMatch(/Enc|super-secret/);
    // saved keys are the ones used by the payment service
    const cfg = await require('../src/services/settings.service').getPaymentConfig();
    expect(cfg.keySecret).toBe('super-secret-value');
    expect((await request(app).put('/api/v1/admin/payment-settings').set(auth(adminToken)).send({ razorpay: { keyId: 'bad' } })).status).toBe(422);
  });
  test('disabled methods are rejected at checkout and hidden publicly', async () => {
    await request(app).put('/api/v1/admin/payment-settings').set(auth(adminToken)).send({ codEnabled: false });
    expect((await place({ paymentMethod: 'cod' })).status).toBe(422);
    expect((await request(app).get('/api/v1/settings')).body.data.payments.codEnabled).toBe(false);
    expect((await request(app).put('/api/v1/admin/payment-settings').set(auth(adminToken)).send({ onlineEnabled: false })).status).toBe(422); // can't disable both
    await request(app).put('/api/v1/admin/payment-settings').set(auth(adminToken)).send({ codEnabled: true });
  });
});

describe('hero slides', () => {
  test('public list shows active slides in order; admin can add, reorder, hide and delete', async () => {
    const pub = async () => (await request(app).get('/api/v1/hero-slides')).body.data;
    expect((await pub()).length).toBe(4);
    const prod = await models.Product.findOne({ name: 'Margherita' });
    const add = await request(app).post('/api/v1/admin/hero-slides').set(auth(adminToken)).send({ title: 'Pizza Night', subtitle: 'Hot and fresh', image: { url: 'https://res.cloudinary.com/x/pizza.jpg' }, productId: String(prod._id) });
    expect(add.status).toBe(201);
    expect((await request(app).post('/api/v1/admin/hero-slides').set(auth(adminToken)).send({ title: 'Bad', image: { url: 'javascript:alert(1)' } })).status).toBe(422);
    let list = await pub();
    expect(list.at(-1).title).toBe('Pizza Night');
    expect(list.at(-1).productId.slug).toBe('margherita');
    const ids = list.map((s) => s._id).reverse();
    await request(app).post('/api/v1/admin/hero-slides/reorder').set(auth(adminToken)).send({ ids });
    expect((await pub())[0].title).toBe('Pizza Night');
    await request(app).put(`/api/v1/admin/hero-slides/${add.body.data._id}`).set(auth(adminToken)).send({ isActive: false });
    expect((await pub()).length).toBe(4);
    expect((await request(app).delete(`/api/v1/admin/hero-slides/${add.body.data._id}`).set(auth(adminToken))).status).toBe(200);
    expect((await request(app).post('/api/v1/admin/hero-slides').set(auth(custToken)).send({ title: 'x', image: { url: 'https://a.b/c.jpg' } })).status).toBe(403);
  });
});

describe('mobile OTP login', () => {
  const phone = '9812345670';
  test('request, wrong code, correct code creates a verified customer session', async () => {
    const r = await request(app).post('/api/v1/auth/otp/request').send({ phone });
    expect(r.status).toBe(200);
    expect(r.body.data.devOtp).toMatch(/^\d{6}$/); // dev provider only; never present in production
    expect((await request(app).post('/api/v1/auth/otp/request').send({ phone })).status).toBe(429); // resend cooldown
    const bad = await request(app).post('/api/v1/auth/otp/verify').send({ phone, code: '000000' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.message).toMatch(/attempts? left/);
    const ok = await request(app).post('/api/v1/auth/otp/verify').send({ phone, code: r.body.data.devOtp, name: 'Otp User' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.user.phone).toBe(phone);
    expect(ok.body.data.isNew).toBe(true);
    expect(ok.headers['set-cookie'][0]).toMatch(/aran_rt=/);
    const u = await models.User.findOne({ phone });
    expect(u.isPhoneVerified).toBe(true);
    expect((await request(app).get('/api/v1/account/me').set(auth(ok.body.data.accessToken))).body.data.name).toBe('Otp User');
    // code is single-use
    expect((await request(app).post('/api/v1/auth/otp/verify').send({ phone, code: r.body.data.devOtp })).status).toBe(400);
  });
  test('five wrong attempts burn the code; invalid numbers and staff numbers are refused', async () => {
    const p2 = '9812345671';
    const r = await request(app).post('/api/v1/auth/otp/request').send({ phone: p2 });
    for (let i = 0; i < 5; i++) await request(app).post('/api/v1/auth/otp/verify').send({ phone: p2, code: '111111' });
    expect((await request(app).post('/api/v1/auth/otp/verify').send({ phone: p2, code: r.body.data.devOtp })).status).toBe(429);
    expect((await request(app).post('/api/v1/auth/otp/request').send({ phone: '12345' })).status).toBe(422);
    await models.User.create({ name: 'Staff', phone: '9812345672', role: 'staff' });
    expect((await request(app).post('/api/v1/auth/otp/request').send({ phone: '9812345672' })).status).toBe(403);
  });
  test('expired codes are rejected', async () => {
    const p3 = '9812345673';
    const r = await request(app).post('/api/v1/auth/otp/request').send({ phone: p3 });
    await models.Otp.collection.updateOne({ phone: p3 }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await request(app).post('/api/v1/auth/otp/verify').send({ phone: p3, code: r.body.data.devOtp })).status).toBe(400);
  });
  test('checkout requires a verified login when guest checkout is off', async () => {
    await settingsSvc.updateSettings({ guestCheckout: false });
    expect((await place()).status).toBe(401);
    await settingsSvc.updateSettings({ guestCheckout: true });
  });
});

describe('delivery partner app', () => {
  test('rider logs in by OTP, picks up, must enter the customer code to deliver (COD cash recorded)', async () => {
    const phone = '9812345680';
    const created = await request(app).post('/api/v1/admin/delivery/partners').set(auth(adminToken)).send({ name: 'Rider One', phone });
    expect(created.status).toBe(201);
    const o = (await place({ items: [{ productId: String(limited._id), quantity: 1 }] }, custToken)).body.data;
    await models.Inventory.updateOne({ productId: limited._id }, { availableQuantity: 50 });
    const code = (await models.Order.findById(o._id).select('+deliveryCode')).deliveryCode;
    expect(code).toMatch(/^\d{4}$/);
    expect((await request(app).get(`/api/v1/orders/${o._id}`).set(auth(custToken))).body.data.deliveryCode).toBe(code); // customer sees it
    expect((await request(app).get(`/api/v1/admin/orders/${o._id}`).set(auth(adminToken))).body.data.deliveryCode).toBeUndefined();
    await request(app).post(`/api/v1/admin/orders/${o._id}/assign`).set(auth(adminToken)).send({ partnerId: created.body.data._id });
    for (const s of ['confirmed', 'preparing', 'ready']) await request(app).post(`/api/v1/admin/orders/${o._id}/status`).set(auth(adminToken)).send({ status: s });

    const rq = await request(app).post('/api/v1/auth/otp/request').send({ phone });
    const login = await request(app).post('/api/v1/auth/otp/verify').send({ phone, code: rq.body.data.devOtp });
    expect(login.body.data.user.role).toBe('delivery');
    const rider = login.body.data.accessToken;
    expect((await request(app).get('/api/v1/admin/orders').set(auth(rider))).status).toBe(403); // not an admin
    expect((await request(app).get('/api/v1/delivery/orders').set(auth(custToken))).status).toBe(403);
    const mine = await request(app).get('/api/v1/delivery/orders').set(auth(rider));
    expect(mine.body.data.active).toHaveLength(1);
    expect(JSON.stringify(mine.body)).not.toContain(code);
    expect((await request(app).post(`/api/v1/delivery/orders/${o._id}/pickup`).set(auth(rider))).status).toBe(200);
    expect((await request(app).post('/api/v1/delivery/location').set(auth(rider)).send({ lat: 18.52, lng: 73.85 })).status).toBe(200);
    expect((await request(app).get(`/api/v1/orders/${o._id}`).set(auth(custToken))).body.data.deliveryPartnerId.lastLocation.lat).toBe(18.52);
    const wrong = code === '0000' ? '1111' : '0000';
    expect((await request(app).post(`/api/v1/delivery/orders/${o._id}/deliver`).set(auth(rider)).send({ code: wrong })).status).toBe(400);
    const done = await request(app).post(`/api/v1/delivery/orders/${o._id}/deliver`).set(auth(rider)).send({ code });
    expect(done.status).toBe(200);
    const final = await models.Order.findById(o._id);
    expect(final.orderStatus).toBe('delivered');
    expect(final.paymentStatus).toBe('paid');
  });
});

describe('loyalty, referrals, dispatch, geo', () => {
  const login = async (phone, referralCode) => {
    const r = await request(app).post('/api/v1/auth/otp/request').send({ phone });
    const v = await request(app).post('/api/v1/auth/otp/verify').send({ phone, code: r.body.data.devOtp, name: 'Loyal User', ...(referralCode ? { referralCode } : {}) });
    return { token: v.body.data.accessToken, id: v.body.data.user.id };
  };
  const finish = async (orderId) => {
    for (const s of ['confirmed', 'preparing', 'ready']) await request(app).post(`/api/v1/admin/orders/${orderId}/status`).set(auth(adminToken)).send({ status: s });
  };
  test('points are earned on completion, redeemed at checkout, and returned on cancellation', async () => {
    const a = await login('9811100001');
    const pizza = await models.Product.findOne({ name: 'Farmhouse' }); // ₹319
    const o1 = (await place({ items: [{ productId: String(pizza._id), quantity: 2 }], orderType: 'pickup', address: undefined }, a.token)).body.data;
    await finish(o1._id);
    await request(app).post(`/api/v1/admin/orders/${o1._id}/status`).set(auth(adminToken)).send({ status: 'picked_up' });
    const l = (await request(app).get('/api/v1/account/loyalty').set(auth(a.token))).body.data;
    expect(l.points).toBe(Math.floor((63800 / 10000) * 5)); // ₹638 -> 5 points per ₹100
    expect(l.referralCode).toMatch(/^[A-Z2-9]{6}$/);
    // redeem: capped at 20% of the order and never above the balance
    const body = { items: [{ productId: String(pizza._id), quantity: 1 }], orderType: 'pickup', redeemPoints: true };
    const quote = (await request(app).post('/api/v1/cart/quote').set(auth(a.token)).send(body)).body.data.pricing;
    expect(quote.pointsRedeemed).toBe(l.points);
    expect(quote.loyaltyDiscountPaise).toBe(l.points * 50);
    const o2 = (await place({ ...body, address: undefined }, a.token)).body.data;
    expect(o2.pricingSnapshot.pointsRedeemed).toBe(l.points);
    expect((await models.User.findById(a.id)).loyaltyPoints).toBe(0);
    await request(app).post(`/api/v1/admin/orders/${o2._id}/status`).set(auth(adminToken)).send({ status: 'cancelled', reason: 'test' });
    expect((await models.User.findById(a.id)).loyaltyPoints).toBe(l.points); // returned exactly once
    await request(app).post(`/api/v1/admin/orders/${o2._id}/status`).set(auth(adminToken)).send({ status: 'cancelled', reason: 'again' });
    expect((await models.User.findById(a.id)).loyaltyPoints).toBe(l.points);
  });
  test('referral bonus is paid to both people after the friend’s first completed order, once', async () => {
    const referrer = await login('9811100002');
    const code = (await request(app).get('/api/v1/account/loyalty').set(auth(referrer.token))).body.data.referralCode;
    const friend = await login('9811100003', code);
    expect((await models.User.findById(friend.id)).referredBy.toString()).toBe(referrer.id);
    const pizza = await models.Product.findOne({ name: 'Farmhouse' });
    for (let i = 0; i < 2; i++) {
      const o = (await place({ items: [{ productId: String(pizza._id), quantity: 1 }], orderType: 'pickup', address: undefined }, friend.token)).body.data;
      await finish(o._id);
      await request(app).post(`/api/v1/admin/orders/${o._id}/status`).set(auth(adminToken)).send({ status: 'picked_up' });
    }
    expect((await models.User.findById(referrer.id)).loyaltyPoints).toBe(100);
    const f = await models.User.findById(friend.id);
    expect(f.loyaltyPoints).toBe(100 + 2 * Math.floor((31900 / 10000) * 5));
  });
  test('auto-dispatch picks the least-loaded rider who is on duty', async () => {
    await settingsSvc.updateSettings({ delivery: { autoAssign: true } });
    const mk = async (phone, name) => (await request(app).post('/api/v1/admin/delivery/partners').set(auth(adminToken)).send({ name, phone })).body.data;
    const p1 = await mk('9811100010', 'Rider A'), p2 = await mk('9811100011', 'Rider B');
    const now = new Date();
    await models.DeliveryPartner.updateOne({ _id: p1._id }, { lastLocation: { lat: 18.5, lng: 73.8, at: now } });
    await models.DeliveryPartner.updateOne({ _id: p2._id }, { lastLocation: { lat: 18.5, lng: 73.8, at: now } });
    const ids = [];
    for (let i = 0; i < 2; i++) {
      const o = (await place({}, custToken)).body.data; ids.push(o._id);
      await request(app).post(`/api/v1/admin/orders/${o._id}/status`).set(auth(adminToken)).send({ status: 'confirmed' });
    }
    const assigned = (await models.Order.find({ _id: { $in: ids } })).map((o) => String(o.deliveryPartnerId));
    expect(new Set(assigned).size).toBe(2); // spread across both riders
    await settingsSvc.updateSettings({ delivery: { autoAssign: false } });
  });
  test('address search is proxied, cached and validated', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => [{ display_name: 'MG Road, Pune, 411001', name: 'MG Road', lat: '18.51', lon: '73.85', address: { road: 'MG Road', city: 'Pune', postcode: '411001' } }] }));
    const r = await request(app).get('/api/v1/geo/search?q=MG%20Road%20Pune');
    expect(r.body.data[0]).toMatchObject({ city: 'Pune', pincode: '411001', lat: 18.51 });
    await request(app).get('/api/v1/geo/search?q=MG%20Road%20Pune');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect((await request(app).get('/api/v1/geo/search?q=ab')).status).toBe(422);
  });
});

describe('admin', () => {
  test('dashboard, reports, csv, product archive', async () => {
    const d = await request(app).get('/api/v1/admin/dashboard?range=30d').set(auth(adminToken));
    expect(d.status).toBe(200);
    expect(d.body.data.summary.orders).toBeGreaterThan(0);
    const csv = await request(app).get('/api/v1/admin/reports/sales?range=30d&format=csv').set(auth(adminToken));
    expect(csv.headers['content-type']).toMatch(/csv/);
    const del = await request(app).delete(`/api/v1/admin/products/${burger._id}`).set(auth(adminToken));
    expect(del.body.data.isArchived).toBe(true);
    expect((await request(app).get('/api/v1/products/classic-aran-burger')).status).toBe(404);
    expect(await models.Product.findById(burger._id)).toBeTruthy();
  });
});
