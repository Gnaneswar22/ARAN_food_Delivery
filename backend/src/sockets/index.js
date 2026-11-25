const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { User, Order } = require('../models');

let io = null;

function initSockets(httpServer) {
  io = new Server(httpServer, { cors: { origin: config.clientOrigins, credentials: true } });
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (token) {
        const p = jwt.verify(token, config.jwt.accessSecret);
        const u = await User.findById(p.sub);
        if (u?.isActive) socket.data.user = u;
      }
    } catch { /* anonymous allowed for guest order tracking */ }
    next();
  });
  io.on('connection', (socket) => {
    const u = socket.data.user;
    if (u) {
      socket.join(`user:${u._id}`);
      if (['owner', 'manager', 'staff'].includes(u.role)) socket.join('admin');
    }
    // Subscribe to a single order: owner/admin, or guest holding the order's guest token.
    socket.on('order:subscribe', async ({ orderId, guestToken } = {}, ack) => {
      try {
        const o = await Order.findById(orderId).select('+guestToken userId');
        const allowed = o && ((u && (['owner', 'manager', 'staff'].includes(u.role) || String(o.userId) === String(u._id))) || (guestToken && o.guestToken === guestToken));
        if (allowed) { socket.join(`order:${orderId}`); ack?.({ ok: true }); } else ack?.({ ok: false });
      } catch { ack?.({ ok: false }); }
    });
  });
  return io;
}

const emit = (room, event, payload) => io && io.to(room).emit(event, payload);

module.exports = { initSockets, emit };
