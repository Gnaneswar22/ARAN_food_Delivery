const crypto = require('crypto');
const { getPaymentConfig } = require('./settings.service');
const { Order, Payment } = require('../models');
const { ApiError } = require('../utils');
const { notify, orderStatusChanged } = require('./notify.service');
const orderSvc = require('./order.service');
const { emit } = require('../sockets');

const basicAuth = (c) => `Basic ${Buffer.from(`${c.keyId}:${c.keySecret}`).toString('base64')}`;
const hmac = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('hex');
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

async function rzp(path, body) {
  const cfg = await getPaymentConfig();
  if (!cfg.configured) throw new ApiError(503, 'Online payments are not configured on this server');
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: basicAuth(cfg) },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(502, json?.error?.description || 'Payment provider error');
  return json;
}

/** Step 1: backend creates (or reuses) a Razorpay order for an unpaid online order. */
async function createPaymentOrder(order) {
  if (order.paymentMethod !== 'online') throw new ApiError(409, 'Not an online payment order');
  if (order.orderStatus !== 'pending_payment') throw new ApiError(409, 'Order is not awaiting payment');
  const cfg = await getPaymentConfig();
  if (!cfg.configured) throw new ApiError(503, 'Online payments are not configured on this server');
  let pay = await Payment.findOne({ orderId: order._id, status: { $in: ['created', 'failed'] } });
  if (!pay) {
    const rp = await rzp('/orders', { amount: order.pricingSnapshot.totalPaise, currency: 'INR', receipt: order.orderNumber, notes: { orderId: String(order._id) } });
    pay = await Payment.create({ orderId: order._id, userId: order.userId, providerOrderId: rp.id, amountPaise: rp.amount, currency: rp.currency });
  }
  return { keyId: cfg.keyId, razorpayOrderId: pay.providerOrderId, amountPaise: pay.amountPaise, currency: pay.currency, orderNumber: order.orderNumber, prefill: { name: order.customer?.name, email: order.customer?.email, contact: order.customer?.phone } };
}

/** Idempotent capture handler shared by client verification and webhooks. */
async function markCaptured({ providerOrderId, providerPaymentId, amountPaise, signatureVerified = false, eventId }) {
  const pay = await Payment.findOneAndUpdate(
    { providerOrderId, status: { $in: ['created', 'failed'] } },
    { status: 'captured', providerPaymentId, ...(signatureVerified ? { signatureVerified: true } : {}), ...(eventId ? { $addToSet: { webhookEventIds: eventId } } : {}) },
    { returnDocument: 'after' }
  );
  if (!pay) { // already captured (duplicate callback/webhook) -> record signature/event and return current state
    const existing = await Payment.findOneAndUpdate({ providerOrderId }, { ...(signatureVerified ? { signatureVerified: true } : {}), ...(eventId ? { $addToSet: { webhookEventIds: eventId } } : {}) }, { returnDocument: 'after' });
    return { duplicate: true, payment: existing, order: existing && (await Order.findById(existing.orderId)) };
  }
  if (amountPaise != null && amountPaise !== pay.amountPaise) {
    await notify({ audience: 'admin', type: 'payment.mismatch', title: 'Payment amount mismatch', body: `Order payment ${providerPaymentId}`, data: { orderId: pay.orderId } });
  }
  const order = await Order.findOneAndUpdate({ _id: pay.orderId, orderStatus: 'pending_payment' }, { orderStatus: 'placed', paymentStatus: 'paid', $push: { statusHistory: { status: 'placed', note: 'Payment verified' } } }, { returnDocument: 'after' });
  if (order) {
    await orderSvc.onOrderPlaced(order);
    await notify({ userId: order.userId, type: 'payment.success', title: 'Payment successful', body: `Payment received for ${order.orderNumber}`, data: { orderId: order._id }, email: order.customer?.email });
    return { order, payment: pay };
  }
  // Order was cancelled/expired before payment landed -> money must go back
  const late = await Order.findById(pay.orderId);
  if (late && late.orderStatus === 'cancelled' && late.paymentStatus !== 'refunded') {
    late.paymentStatus = 'paid';
    await late.save();
    try { await refund(late._id, { reason: 'Payment received after order expired' }); } catch (e) {
      await notify({ audience: 'admin', type: 'refund.failed', title: 'Late payment needs refund', body: `${late.orderNumber}: ${e.message}`, data: { orderId: late._id } });
    }
  } else if (late && late.paymentStatus !== 'paid') { late.paymentStatus = 'paid'; await late.save(); }
  return { order: late, payment: pay };
}

/** Step 4/5: client posts Razorpay response; we verify the signature server-side. */
async function verifyClientPayment(order, { razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  const pay = await Payment.findOne({ orderId: order._id, providerOrderId: razorpay_order_id });
  if (!pay) throw new ApiError(404, 'Payment record not found');
  const cfg = await getPaymentConfig();
  const expected = hmac(cfg.keySecret || '', `${razorpay_order_id}|${razorpay_payment_id}`);
  if (!cfg.configured || !safeEq(expected, razorpay_signature)) {
    await Payment.updateOne({ _id: pay._id, status: { $ne: 'captured' } }, { status: 'failed', failureReason: 'Signature verification failed' });
    throw new ApiError(400, 'Payment signature verification failed');
  }
  return markCaptured({ providerOrderId: razorpay_order_id, providerPaymentId: razorpay_payment_id, signatureVerified: true });
}

async function markFailed(order, reason) {
  await Payment.updateOne({ orderId: order._id, status: 'created' }, { status: 'failed', failureReason: reason });
  if (order.orderStatus === 'pending_payment') await Order.updateOne({ _id: order._id }, { paymentStatus: 'failed' });
  await notify({ audience: 'admin', type: 'payment.failed', title: 'Payment failed', body: `${order.orderNumber}: ${reason || 'failed'}`, data: { orderId: order._id } });
  emit(`order:${order._id}`, 'order:updated', { orderId: order._id, paymentStatus: 'failed' });
}

/** Authoritative provider events. `rawBody` must be the exact bytes received. */
async function handleWebhook(rawBody, signature) {
  const cfg = await getPaymentConfig();
  if (!cfg.webhookSecret) throw new ApiError(503, 'Webhook secret not configured');
  if (!signature || !safeEq(hmac(cfg.webhookSecret, rawBody), signature)) throw new ApiError(400, 'Invalid webhook signature');
  const evt = JSON.parse(rawBody.toString('utf8'));
  const eventId = evt.id || `${evt.event}:${evt.payload?.payment?.entity?.id}`;
  const p = evt.payload?.payment?.entity;
  if (evt.event === 'payment.captured' || evt.event === 'order.paid') {
    const entity = p || evt.payload?.order?.entity;
    const providerOrderId = p?.order_id || entity?.id;
    const providerPaymentId = p?.id;
    if (providerOrderId) await markCaptured({ providerOrderId, providerPaymentId, amountPaise: p?.amount, eventId });
  } else if (evt.event === 'payment.failed' && p?.order_id) {
    const pay = await Payment.findOne({ providerOrderId: p.order_id });
    if (pay && pay.status !== 'captured' && !pay.webhookEventIds.includes(eventId)) {
      await Payment.updateOne({ _id: pay._id }, { $addToSet: { webhookEventIds: eventId } });
      const o = await Order.findById(pay.orderId);
      if (o) await markFailed(o, p.error_description);
    }
  } else if (evt.event === 'refund.processed' || evt.event === 'refund.failed') {
    const r = evt.payload?.refund?.entity;
    if (r) {
      const pay = await Payment.findOne({ providerPaymentId: r.payment_id });
      if (pay && !pay.webhookEventIds.includes(eventId)) {
        await Payment.updateOne({ _id: pay._id }, { $addToSet: { webhookEventIds: eventId } });
        if (evt.event === 'refund.failed') await notify({ audience: 'admin', type: 'refund.failed', title: 'Refund failed', body: `Payment ${r.payment_id}`, data: { orderId: pay.orderId } });
      }
    }
  }
  return { received: true };
}

/** Full or partial refund against a captured online payment. */
async function refund(orderId, { amountPaise, reason } = {}) {
  const order = await Order.findById(orderId);
  const pay = await Payment.findOne({ orderId, status: { $in: ['captured', 'partially_refunded'] } });
  if (!order || !pay) throw new ApiError(404, 'No captured payment found for this order');
  const refunded = pay.refunds.reduce((a, r) => a + r.amountPaise, 0);
  const amt = amountPaise ?? pay.amountPaise - refunded;
  if (amt <= 0 || refunded + amt > pay.amountPaise) throw new ApiError(422, 'Invalid refund amount');
  const r = await rzp(`/payments/${pay.providerPaymentId}/refund`, { amount: amt, notes: { reason: reason || '', orderId: String(orderId) } });
  const full = refunded + amt >= pay.amountPaise;
  pay.refunds.push({ refundId: r.id, amountPaise: amt, reason });
  pay.status = full ? 'refunded' : 'partially_refunded';
  await pay.save();
  order.refundedPaise = refunded + amt;
  order.paymentStatus = full ? 'refunded' : 'partially_refunded';
  order.statusHistory.push({ status: order.orderStatus, note: `Refund ₹${(amt / 100).toFixed(2)} initiated` });
  await order.save();
  await notify({ userId: order.userId, type: 'refund.update', title: 'Refund initiated', body: `₹${(amt / 100).toFixed(2)} for ${order.orderNumber} will reach your account in 5-7 days`, data: { orderId: order._id }, email: order.customer?.email });
  return order;
}

/** Reconciliation: compare local pending payments to provider state. */
async function reconcile() {
  const cfg = await getPaymentConfig();
  if (!cfg.configured) throw new ApiError(503, 'Online payments are not configured');
  const pending = await Payment.find({ status: { $in: ['created', 'failed'] }, createdAt: { $gt: new Date(Date.now() - 864e5) } }).limit(100);
  let fixed = 0;
  for (const p of pending) {
    const res = await fetch(`https://api.razorpay.com/v1/orders/${p.providerOrderId}/payments`, { headers: { Authorization: basicAuth(cfg) } });
    if (!res.ok) continue;
    const cap = (await res.json()).items?.find((x) => x.status === 'captured');
    if (cap) { await markCaptured({ providerOrderId: p.providerOrderId, providerPaymentId: cap.id, amountPaise: cap.amount }); fixed++; }
  }
  return { checked: pending.length, fixed };
}

/** Verify saved credentials against Razorpay without creating anything. */
async function testConnection() {
  const cfg = await getPaymentConfig();
  if (!cfg.configured) throw new ApiError(422, 'Enter and save a Key ID and Key Secret first');
  const res = await fetch('https://api.razorpay.com/v1/payments?count=1', { headers: { Authorization: basicAuth(cfg) } });
  if (res.status === 401) throw new ApiError(422, 'Razorpay rejected these credentials (check Key ID / Secret and test vs live mode)');
  if (!res.ok) throw new ApiError(502, 'Could not reach Razorpay, try again');
  return { ok: true, mode: cfg.keyId.startsWith('rzp_live') ? 'live' : 'test', webhookSecretSet: !!cfg.webhookSecret };
}

module.exports = { testConnection, createPaymentOrder, verifyClientPayment, handleWebhook, refund, reconcile, markCaptured, markFailed, hmac };
