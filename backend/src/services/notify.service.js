const nodemailer = require('nodemailer');
const webpush = require('web-push');
const config = require('../config');
const { Notification, User } = require('../models');
const { emit } = require('../sockets');
const { logger } = require('../utils');

let transport = null;
if (config.smtp.host) transport = nodemailer.createTransport({ host: config.smtp.host, port: config.smtp.port, auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined });
const pushReady = !!(config.vapid.publicKey && config.vapid.privateKey);
if (pushReady) webpush.setVapidDetails(config.vapid.subject, config.vapid.publicKey, config.vapid.privateKey);

async function sendEmail(to, subject, text) {
  if (!transport || !to) return false; // not configured -> skipped (never pretend)
  await transport.sendMail({ from: config.smtp.from, to, subject, text });
  return true;
}

async function sendWhatsApp(phone, text) {
  if (!config.whatsapp.token || !phone) return false;
  const res = await fetch(`https://graph.facebook.com/v20.0/${config.whatsapp.phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.whatsapp.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: phone.replace(/\D/g, ''), type: 'text', text: { body: text } }),
  });
  return res.ok;
}

async function sendPush(user, payload) {
  if (!pushReady || !user?.pushSubscriptions?.length) return;
  for (const sub of user.pushSubscriptions) {
    try { await webpush.sendNotification(sub, JSON.stringify(payload)); }
    catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await User.updateOne({ _id: user._id }, { $pull: { pushSubscriptions: { endpoint: sub.endpoint } } }); }
  }
}

/** Notify a customer (userId) or the admin audience. Called from verified backend events only. */
async function notify({ userId, audience = 'customer', type, title, body, data, email, phone }) {
  try {
    const n = await Notification.create({ userId, audience, type, title, body, data });
    if (audience === 'admin') emit('admin', 'notification', n);
    else if (userId) emit(`user:${userId}`, 'notification', n);
    if (audience === 'customer') {
      const { getSettings } = require('./settings.service');
      const s = await getSettings();
      if (s.notifications?.customerUpdates !== false) {
        const user = userId ? await User.findById(userId) : null;
        await sendPush(user, { title, body, data });
        if (s.notifications?.emailEnabled) await sendEmail(email || user?.email, title, body);
        if (s.notifications?.whatsappEnabled) await sendWhatsApp(phone || user?.phone, `${title}: ${body}`);
      }
    }
    return n;
  } catch (e) {
    logger.error('notify failed', { error: e.message });
  }
}

const STATUS_COPY = {
  placed: ['Order received', 'We have received your order.'],
  confirmed: ['Order accepted', 'ARAN.co has accepted your order.'],
  preparing: ['Preparing your food', 'Your food is being prepared.'],
  ready: ['Ready', 'Your order is ready.'],
  out_for_delivery: ['Out for delivery', 'Your order is on its way.'],
  delivered: ['Delivered', 'Enjoy your meal!'],
  picked_up: ['Picked up', 'Thanks for picking up your order.'],
  cancelled: ['Order cancelled', 'Your order has been cancelled.'],
};

async function orderStatusChanged(order) {
  emit(`order:${order._id}`, 'order:updated', { orderId: order._id, orderStatus: order.orderStatus, paymentStatus: order.paymentStatus, statusHistory: order.statusHistory });
  emit('admin', 'order:updated', { orderId: order._id, orderStatus: order.orderStatus });
  const c = STATUS_COPY[order.orderStatus];
  if (c) await notify({ userId: order.userId, type: `order.${order.orderStatus}`, title: `${c[0]} · ${order.orderNumber}`, body: c[1], data: { orderId: order._id }, email: order.customer?.email, phone: order.customer?.phone });
}

module.exports = { notify, sendEmail, sendWhatsApp, orderStatusChanged, pushReady };
