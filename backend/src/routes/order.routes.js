const router = require('express').Router();
const express = require('express');
const { Order } = require('../models');
const { asyncHandler, ok, ApiError, pageParams } = require('../utils');
const { authenticate, optionalAuth, validate, limiter, ADMIN_ROLES } = require('../middleware');
const v = require('../validators');
const orderSvc = require('../services/order.service');
const paySvc = require('../services/payment.service');

/** Resolve an order the caller may access: owner, staff, or guest holding the token. */
async function accessibleOrder(req) {
  const o = await Order.findById(req.params.id).select('+guestToken +deliveryCode');
  if (!o) throw new ApiError(404, 'Order not found');
  const u = req.user;
  const token = req.get('x-guest-token') || req.query.guestToken;
  const allowed = (u && (ADMIN_ROLES.includes(u.role) || String(o.userId) === String(u._id))) || (!o.userId && token && token === o.guestToken);
  if (!allowed) throw new ApiError(404, 'Order not found');
  return o;
}
// Handover code is for the customer only (staff/riders never see it); partner's live position shown only while out for delivery.
const strip =(o, viewer) => { const x = o.toObject(); delete x.guestToken; if (viewer && ADMIN_ROLES.includes(viewer.role)) delete x.deliveryCode; if (x.orderStatus !== 'out_for_delivery' && x.deliveryPartnerId) delete x.deliveryPartnerId.lastLocation; return x; };

router.post('/orders', limiter(60 * 1000, 20), optionalAuth, validate(v.checkout), asyncHandler(async (req, res) => {
  const { order, duplicate } = await orderSvc.create({ user: req.user, body: req.body });
  ok(res, order, { duplicate: !!duplicate }, duplicate ? 200 : 201);
}));

router.get('/orders', authenticate, asyncHandler(async (req, res) => {
  const { page, limit, skip } = pageParams(req.query);
  const f = { userId: req.user._id, orderStatus: { $ne: 'pending_payment' } };
  const [items, total] = await Promise.all([Order.find(f).sort({ createdAt: -1 }).skip(skip).limit(limit), Order.countDocuments(f)]);
  ok(res, items, { page, limit, total, pages: Math.ceil(total / limit) });
}));

router.get('/orders/:id', optionalAuth, asyncHandler(async (req, res) => {
  const o = await accessibleOrder(req);
  const populated = await o.populate('deliveryPartnerId', 'name phone lastLocation');
  ok(res, strip(populated, req.user));
}));

router.post('/orders/:id/cancel', authenticate, asyncHandler(async (req, res) => {
  const o = await accessibleOrder(req);
  ok(res, await orderSvc.customerCancel(o, req.user));
}));

// Payments
router.post('/orders/:id/payment', limiter(60 * 1000, 15), optionalAuth, asyncHandler(async (req, res) => {
  ok(res, await paySvc.createPaymentOrder(await accessibleOrder(req)));
}));
router.post('/orders/:id/payment/verify', optionalAuth, validate(v.z.object({ razorpay_order_id: v.z.string(), razorpay_payment_id: v.z.string(), razorpay_signature: v.z.string() })), asyncHandler(async (req, res) => {
  const r = await paySvc.verifyClientPayment(await accessibleOrder(req), req.body);
  ok(res, { orderStatus: r.order?.orderStatus, paymentStatus: r.order?.paymentStatus, duplicate: !!r.duplicate });
}));
router.post('/orders/:id/payment/failed', optionalAuth, validate(v.z.object({ reason: v.z.string().max(200).optional() })), asyncHandler(async (req, res) => {
  // Client report only records the attempt; the webhook is authoritative for final state.
  const o = await accessibleOrder(req);
  await paySvc.markFailed(o, req.body.reason || 'Payment cancelled or failed');
  ok(res, { recorded: true });
}));

// Razorpay webhook: raw body required for signature verification
router.post('/webhooks/razorpay', express.raw({ type: '*/*', limit: '1mb' }), asyncHandler(async (req, res) => {
  ok(res, await paySvc.handleWebhook(req.body, req.get('x-razorpay-signature')));
}));

module.exports = router;
