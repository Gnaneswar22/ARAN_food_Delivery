/** Delivery partner app API. Riders sign in with mobile OTP (role "delivery") and only see their own assigned orders. */
const router = require('express').Router();
const crypto = require('crypto');
const { Order, DeliveryPartner } = require('../models');
const { asyncHandler, ok, ApiError } = require('../utils');
const { authenticate, requireRoles, validate } = require('../middleware');
const { z } = require('../validators');
const orderSvc = require('../services/order.service');
const { emit } = require('../sockets');

router.use(authenticate, requireRoles('delivery'));

const myPartner = async (req) => {
  const p = await DeliveryPartner.findOne({ userId: req.user._id, isActive: true });
  if (!p) throw new ApiError(403, 'Your delivery profile is inactive. Contact the restaurant.');
  return p;
};
const myOrder = async (req, extra = '') => {
  const p = await myPartner(req);
  const o = await Order.findOne({ _id: req.params.id, deliveryPartnerId: p._id }).select(extra);
  if (!o) throw new ApiError(404, 'Order not found');
  return { o, p };
};

router.get('/orders', asyncHandler(async (req, res) => {
  const p = await myPartner(req);
  const orders = await Order.find({ deliveryPartnerId: p._id, orderStatus: { $in: ['confirmed', 'preparing', 'ready', 'out_for_delivery'] } }).sort({ createdAt: 1 })
    .select('orderNumber customer items deliveryAddressSnapshot deliveryInstructions pricingSnapshot paymentMethod paymentStatus orderStatus codCollection createdAt');
  const history = await Order.find({ deliveryPartnerId: p._id, orderStatus: 'delivered', updatedAt: { $gt: new Date(Date.now() - 864e5) } }).select('orderNumber pricingSnapshot updatedAt').limit(30);
  ok(res, { partner: { name: p.name, phone: p.phone }, active: orders, delivered24h: history });
}));

router.post('/orders/:id/pickup', asyncHandler(async (req, res) => {
  const { o } = await myOrder(req);
  if (o.orderStatus !== 'ready') throw new ApiError(409, 'This order is not ready for pickup from the kitchen yet');
  ok(res, await orderSvc.transition(o._id, 'out_for_delivery', { by: req.user._id, note: 'Picked up by rider' }));
}));

// Handover: the customer reads out the 4-digit code shown in their app; wrong codes are limited.
const attempts = new Map();
router.post('/orders/:id/deliver', validate(z.object({ code: z.string().regex(/^\d{4}$/, 'Enter the 4-digit code') })), asyncHandler(async (req, res) => {
  const { o } = await myOrder(req, '+deliveryCode');
  if (o.orderStatus !== 'out_for_delivery') throw new ApiError(409, 'Pick the order up first');
  const key = String(o._id);
  const n = attempts.get(key) || 0;
  if (n >= 5) throw new ApiError(429, 'Too many wrong codes. Contact the restaurant.');
  const a = Buffer.from(String(o.deliveryCode || '')), b = Buffer.from(req.body.code);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) { attempts.set(key, n + 1); throw new ApiError(400, 'Incorrect delivery code'); }
  attempts.delete(key);
  if (o.paymentMethod === 'cod' && o.paymentStatus !== 'paid') await orderSvc.recordCodCollection(o._id, {}, req.user._id); // rider collected the cash
  ok(res, await orderSvc.transition(o._id, 'delivered', { by: req.user._id, note: 'Delivered (code verified)' }));
}));

// Live location from the rider's phone. Customers only see it while their order is out for delivery.
router.post('/location', validate(z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })), asyncHandler(async (req, res) => {
  const p = await myPartner(req);
  p.lastLocation = { lat: req.body.lat, lng: req.body.lng, at: new Date() };
  await p.save();
  const live = await Order.find({ deliveryPartnerId: p._id, orderStatus: 'out_for_delivery' }).select('_id');
  live.forEach((o) => emit(`order:${o._id}`, 'order:updated', { orderId: o._id, orderStatus: 'out_for_delivery' }));
  ok(res, { updated: true });
}));

module.exports = router;
