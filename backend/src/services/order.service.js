const { Order, Counter, Coupon, DeliveryPartner } = require('../models');
const { ApiError, randomToken } = require('../utils');
const pricing = require('./pricing.service');
const inventory = require('./inventory.service');
const settingsSvc = require('./settings.service');
const loyalty = require('./loyalty.service');
const { notify, orderStatusChanged } = require('./notify.service');
const { emit } = require('../sockets');

// Valid state machine (backend-enforced)
const TRANSITIONS = {
  pending_payment: ['placed', 'cancelled'],
  placed: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['out_for_delivery', 'picked_up', 'cancelled'],
  out_for_delivery: ['delivered'],
  delivered: [],
  picked_up: [],
  cancelled: [],
};
const FINAL = ['delivered', 'picked_up'];

async function nextOrderNumber() {
  const c = await Counter.findOneAndUpdate({ _id: 'order' }, { $inc: { seq: 1 } }, { returnDocument: 'after', upsert: true });
  return `ARN${String(c.seq).padStart(6, '0')}`;
}

async function create({ user, body }) {
  const s = await settingsSvc.getSettings(true);
  await settingsSvc.assertOpen();
  if (!user && s.guestCheckout === false) throw new ApiError(401, 'Please sign in to place an order');

  // Idempotency: same key => same order, never a duplicate
  if (body.idempotencyKey) {
    const dup = await Order.findOne({ idempotencyKey: body.idempotencyKey, ...(user ? { userId: user._id } : { userId: null }) });
    if (dup) return { order: dup, duplicate: true };
  }

  const pay = await settingsSvc.getPaymentConfig();
  if (body.paymentMethod === 'online' && !pay.onlineEnabled) throw new ApiError(422, 'Online payment is currently unavailable. Please choose another method.');
  if (body.paymentMethod === 'cod' && !pay.codEnabled) throw new ApiError(422, 'Cash on delivery is currently unavailable. Please pay online.');

  let address = body.address;
  if (body.orderType === 'delivery' && !address) throw new ApiError(422, 'Delivery address is required');
  const q = await pricing.quote({ items: body.items, orderType: body.orderType, address, couponCode: body.couponCode, userId: user?._id, redeemPoints: !!body.redeemPoints });

  const order = new Order({
    orderNumber: await nextOrderNumber(),
    userId: user?._id,
    customer: { name: body.customer.name, phone: body.customer.phone, email: body.customer.email },
    items: q.lines.map(({ productId, name, image, foodType, unitPricePaise, quantity, options, note, lineTotalPaise }) => ({ productId, name, image, foodType, unitPricePaise, quantity, options, note, lineTotalPaise })),
    orderType: body.orderType,
    deliveryAddressSnapshot: body.orderType === 'delivery' ? address : undefined,
    deliveryInstructions: body.deliveryInstructions,
    pickupDetailsSnapshot: body.orderType === 'pickup' ? { address: s.pickup?.address || s.stall?.address, slot: body.pickupSlot, prepMinutes: q.estimatedPrepMinutes } : undefined,
    pricingSnapshot: q.pricing,
    pointsRedeemed: q.pricing.pointsRedeemed,
    paymentMethod: body.paymentMethod,
    paymentStatus: body.paymentMethod === 'cod' ? 'unpaid' : 'pending',
    orderStatus: body.paymentMethod === 'cod' ? 'placed' : 'pending_payment',
    scheduledFor: body.scheduledFor,
    idempotencyKey: body.idempotencyKey,
    deliveryCode: body.orderType === 'delivery' ? String(require('crypto').randomInt(0, 10000)).padStart(4, '0') : undefined,
    guestToken: user ? undefined : randomToken(16),
    statusHistory: [{ status: body.paymentMethod === 'cod' ? 'placed' : 'pending_payment' }],
  });

  await inventory.reserve(order._id, q.lines);
  let couponRedeemed = false, pointsSpent = false;
  try {
    if (q.pricing.pointsRedeemed) {
      pointsSpent = await loyalty.spend(user._id, q.pricing.pointsRedeemed, order._id);
      if (!pointsSpent) throw new ApiError(409, 'Your points balance changed. Please review your order total.');
    }
    if (q.pricing.couponCode) { await redeemCoupon(q.pricing.couponCode, user?._id); couponRedeemed = true; }
    await order.save();
  } catch (e) {
    await inventory.release(order._id, q.lines);
    if (pointsSpent) await loyalty.credit(user._id, q.pricing.pointsRedeemed, 'Points returned (order failed)', order._id);
    if (couponRedeemed) await unredeemCoupon(q.pricing.couponCode, user?._id);
    throw e;
  }

  if (order.orderStatus === 'placed') await onOrderPlaced(order);
  const out = order.toObject();
  if (!user) out.guestToken = order.guestToken;
  return { order: out };
}

async function redeemCoupon(code, userId) {
  const c = await Coupon.findOne({ code });
  const cond = { code, isActive: true, ...(c.usageLimit != null ? { $expr: { $lt: ['$usedCount', c.usageLimit] } } : {}) };
  const r = await Coupon.findOneAndUpdate(cond, { $inc: { usedCount: 1 } }, { returnDocument: 'after' });
  if (!r) throw new ApiError(409, 'Coupon is no longer available');
  if (userId) {
    const upd = await Coupon.updateOne({ code, 'usedBy.userId': userId }, { $inc: { 'usedBy.$.count': 1 } });
    if (!upd.matchedCount) await Coupon.updateOne({ code }, { $push: { usedBy: { userId, count: 1 } } });
  }
}
async function unredeemCoupon(code, userId) {
  await Coupon.updateOne({ code }, { $inc: { usedCount: -1 } });
  if (userId) await Coupon.updateOne({ code, 'usedBy.userId': userId }, { $inc: { 'usedBy.$.count': -1 } });
}

/** Called once an order becomes 'placed' (COD immediately, online after verified payment). */
async function onOrderPlaced(order) {
  emit('admin', 'order:new', { orderId: order._id, orderNumber: order.orderNumber });
  await notify({ audience: 'admin', type: 'order.new', title: 'New order', body: `${order.orderNumber} · ₹${(order.pricingSnapshot.totalPaise / 100).toFixed(0)} · ${order.orderType}`, data: { orderId: order._id } });
  await orderStatusChanged(order);
}

async function transition(orderId, to, { by, note, reason, deliveryPartnerId } = {}) {
  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, 'Order not found');
  if (order.orderStatus === to) return order;
  if (!(TRANSITIONS[order.orderStatus] || []).includes(to)) throw new ApiError(409, `Cannot change order from "${order.orderStatus}" to "${to}"`);
  if (to === 'out_for_delivery' && order.orderType !== 'delivery') throw new ApiError(409, 'Pickup orders cannot go out for delivery');
  if (to === 'picked_up' && order.orderType !== 'pickup') throw new ApiError(409, 'Only pickup orders can be marked picked up');
  if (to === 'out_for_delivery') {
    const pid = deliveryPartnerId || order.deliveryPartnerId;
    if (!pid) throw new ApiError(422, 'Assign a delivery partner first');
  }
  if (to === 'cancelled' && !reason) throw new ApiError(422, 'A cancellation reason is required');

  // Atomic guard against concurrent transitions
  const upd = await Order.findOneAndUpdate(
    { _id: orderId, orderStatus: order.orderStatus },
    { orderStatus: to, ...(reason ? { cancellationReason: reason } : {}), $push: { statusHistory: { status: to, by, note: note || reason } } },
    { returnDocument: 'after' }
  );
  if (!upd) throw new ApiError(409, 'Order was updated by someone else, please refresh');

  if (to === 'confirmed') await require('./dispatch.service').onOrderConfirmed(upd).catch(() => {});
  if (to === 'cancelled') await onCancelled(upd);
  if (FINAL.includes(to) && !upd.stockDeducted) {
    await Order.updateOne({ _id: upd._id }, { stockDeducted: true });
    await inventory.deduct(upd._id, upd.items.map((i) => ({ ...i.toObject(), stockManaged: true })));
    await loyalty.onOrderCompleted(upd).catch(() => {});
  }
  await orderStatusChanged(upd);
  return upd;
}

async function onCancelled(order) {
  if (!order.stockReleased) {
    const claimed = await Order.findOneAndUpdate({ _id: order._id, stockReleased: false }, { stockReleased: true });
    if (claimed) await inventory.release(order._id, order.items.map((i) => ({ ...i.toObject(), stockManaged: true })));
  }
  if (order.pricingSnapshot?.couponCode) await unredeemCoupon(order.pricingSnapshot.couponCode, order.userId).catch(() => {});
  await loyalty.refundRedeemed(order).catch(() => {});
  if (order.paymentMethod === 'online' && order.paymentStatus === 'paid') {
    try { await require('./payment.service').refund(order._id, { reason: `Order cancelled: ${order.cancellationReason}` }); }
    catch (e) { await notify({ audience: 'admin', type: 'refund.failed', title: 'Refund needed', body: `${order.orderNumber}: ${e.message}`, data: { orderId: order._id } }); }
  }
}

async function customerCancel(order, user) {
  if (String(order.userId) !== String(user._id)) throw new ApiError(403, 'Not your order');
  if (!['pending_payment', 'placed'].includes(order.orderStatus)) throw new ApiError(409, 'This order can no longer be cancelled online. Please contact support.');
  return transition(order._id, 'cancelled', { by: user._id, reason: 'Cancelled by customer' });
}

async function assignPartner(orderId, partnerId, by) {
  const [order, partner] = await Promise.all([Order.findById(orderId), DeliveryPartner.findById(partnerId)]);
  if (!order || !partner) throw new ApiError(404, 'Order or partner not found');
  if (order.orderType !== 'delivery') throw new ApiError(409, 'Only delivery orders can be assigned');
  if (['delivered', 'cancelled'].includes(order.orderStatus)) throw new ApiError(409, 'Order is closed');
  order.deliveryPartnerId = partner._id;
  order.statusHistory.push({ status: order.orderStatus, by, note: `Assigned to ${partner.name}` });
  await order.save();
  emit(`order:${order._id}`, 'order:updated', { orderId: order._id, orderStatus: order.orderStatus });
  return order;
}

async function recordCodCollection(orderId, { amountPaise, note }, by) {
  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, 'Order not found');
  if (order.paymentMethod !== 'cod') throw new ApiError(409, 'Not a cash-on-delivery order');
  if (order.orderStatus === 'cancelled') throw new ApiError(409, 'Order is cancelled');
  const collected = order.codCollection.reduce((a, c) => a + c.amountPaise, 0);
  const amt = amountPaise ?? order.pricingSnapshot.totalPaise - collected;
  if (amt <= 0 || collected + amt > order.pricingSnapshot.totalPaise) throw new ApiError(422, 'Invalid collection amount');
  order.codCollection.push({ amountPaise: amt, collectedBy: by, at: new Date(), note });
  if (collected + amt >= order.pricingSnapshot.totalPaise) order.paymentStatus = 'paid';
  await order.save();
  emit(`order:${order._id}`, 'order:updated', { orderId: order._id, paymentStatus: order.paymentStatus });
  return order;
}

/** Payment timeout sweep: cancel unpaid online orders and release their stock. */
async function expireUnpaid(minutes) {
  const cutoff = new Date(Date.now() - minutes * 60000);
  const stale = await Order.find({ orderStatus: 'pending_payment', createdAt: { $lt: cutoff } }).select('_id');
  for (const o of stale) {
    try { await transition(o._id, 'cancelled', { reason: 'Payment not completed in time' }); } catch (e) { if (!/Cannot change order/.test(e.message)) console.error('expire', e); }
  }
  return stale.length;
}

module.exports = { create, transition, customerCancel, assignPartner, recordCodCollection, expireUnpaid, onOrderPlaced, TRANSITIONS };
