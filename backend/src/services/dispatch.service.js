/** Automatic rider assignment: least-loaded rider who is on duty (sent a GPS ping in the last 10 min), nearest to the kitchen as tie-break. */
const { Order, DeliveryPartner } = require('../models');
const { getSettings } = require('./settings.service');
const { haversineKm } = require('../utils');
const { notify } = require('./notify.service');
const { emit } = require('../sockets');

const ON_DUTY_WINDOW_MS = 10 * 60 * 1000;
const ACTIVE = ['confirmed', 'preparing', 'ready', 'out_for_delivery'];

async function pickPartner() {
  const s = await getSettings();
  const partners = await DeliveryPartner.find({ isActive: true, userId: { $exists: true } });
  const onDuty = partners.filter((p) => p.lastLocation?.at && Date.now() - p.lastLocation.at.getTime() < ON_DUTY_WINDOW_MS);
  if (!onDuty.length) return null;
  const loads = await Order.aggregate([{ $match: { deliveryPartnerId: { $in: onDuty.map((p) => p._id) }, orderStatus: { $in: ACTIVE } } }, { $group: { _id: '$deliveryPartnerId', n: { $sum: 1 } } }]);
  const load = new Map(loads.map((l) => [String(l._id), l.n]));
  const km = (p) => (s.stall?.lat != null && p.lastLocation?.lat != null ? haversineKm(s.stall.lat, s.stall.lng, p.lastLocation.lat, p.lastLocation.lng) : 0);
  return onDuty.sort((a, b) => (load.get(String(a._id)) || 0) - (load.get(String(b._id)) || 0) || km(a) - km(b))[0];
}

/** Assign the best available rider to a delivery order that has none. Returns the partner or null. */
async function autoAssign(orderId, by) {
  const partner = await pickPartner();
  if (!partner) return null;
  const o = await Order.findOneAndUpdate({ _id: orderId, orderType: 'delivery', deliveryPartnerId: { $exists: false }, orderStatus: { $in: ACTIVE } },
    { deliveryPartnerId: partner._id, $push: { statusHistory: { status: 'confirmed', by, note: `Auto-assigned to ${partner.name}` } } }, { returnDocument: 'after' });
  if (!o) return null;
  emit(`order:${o._id}`, 'order:updated', { orderId: o._id, orderStatus: o.orderStatus });
  if (partner.userId) notify({ userId: partner.userId, type: 'delivery.assigned', title: 'New delivery assigned', body: `${o.orderNumber} has been assigned to you.`, data: { orderId: o._id } });
  return partner;
}

/** Called when an order is accepted. Respects the admin toggle; alerts the admin when nobody is available. */
async function onOrderConfirmed(order) {
  const s = await getSettings();
  if (!s.delivery?.autoAssign || order.orderType !== 'delivery' || order.deliveryPartnerId) return;
  const p = await autoAssign(order._id);
  if (!p) await notify({ audience: 'admin', type: 'delivery.unassigned', title: 'No rider available', body: `${order.orderNumber} needs a rider — nobody is on duty.`, data: { orderId: order._id } });
}

module.exports = { autoAssign, onOrderConfirmed };
