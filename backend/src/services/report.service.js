const { Order, Product, Inventory, Payment } = require('../models');

const REVENUE_STATUSES = ['placed', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'picked_up'];
const TZ = process.env.BUSINESS_TZ || 'Asia/Kolkata';

function range(q) {
  const now = new Date();
  const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const r = q.range || 'today';
  if (r === 'yesterday') { const e = startOfDay(now); const s = new Date(e - 864e5); return { from: s, to: e }; }
  if (r === '7d') return { from: startOfDay(new Date(now - 6 * 864e5)), to: new Date(+now + 1) };
  if (r === '30d') return { from: startOfDay(new Date(now - 29 * 864e5)), to: new Date(+now + 1) };
  if (r === 'custom' && q.from && q.to) return { from: new Date(q.from), to: new Date(+new Date(q.to) + 864e5) };
  return { from: startOfDay(now), to: new Date(+now + 1) };
}

const GROUP = { day: '%Y-%m-%d', month: '%Y-%m', week: '%G-W%V' };

/** Gross = order value; Net collected = paid/collected amount minus refunds. */
async function summary(q) {
  const { from, to } = range(q);
  const match = { createdAt: { $gte: from, $lt: to } };
  const [agg] = await Order.aggregate([
    { $match: match },
    { $addFields: { collected: { $cond: [{ $eq: ['$paymentMethod', 'cod'] }, { $sum: '$codCollection.amountPaise' }, { $cond: [{ $in: ['$paymentStatus', ['paid', 'refunded', 'partially_refunded']] }, '$pricingSnapshot.totalPaise', 0] }] } } },
    { $group: {
      _id: null,
      orders: { $sum: 1 },
      pending: { $sum: { $cond: [{ $in: ['$orderStatus', ['placed', 'pending_payment']] }, 1, 0] } },
      confirmed: { $sum: { $cond: [{ $in: ['$orderStatus', ['confirmed', 'preparing', 'ready', 'out_for_delivery']] }, 1, 0] } },
      completed: { $sum: { $cond: [{ $in: ['$orderStatus', ['delivered', 'picked_up']] }, 1, 0] } },
      cancelled: { $sum: { $cond: [{ $eq: ['$orderStatus', 'cancelled'] }, 1, 0] } },
      grossPaise: { $sum: { $cond: [{ $in: ['$orderStatus', REVENUE_STATUSES] }, { $add: ['$pricingSnapshot.subtotalPaise', '$pricingSnapshot.taxPaise', '$pricingSnapshot.deliveryFeePaise'] }, 0] } },
      discountPaise: { $sum: { $cond: [{ $in: ['$orderStatus', REVENUE_STATUSES] }, '$pricingSnapshot.discountPaise', 0] } },
      refundsPaise: { $sum: '$refundedPaise' },
      collectedPaise: { $sum: '$collected' },
      validOrders: { $sum: { $cond: [{ $in: ['$orderStatus', REVENUE_STATUSES] }, 1, 0] } },
    } },
  ]);
  const a = agg || {};
  const g = a.grossPaise || 0, d = a.discountPaise || 0, r = a.refundsPaise || 0;
  return {
    range: { from, to },
    orders: a.orders || 0, pending: a.pending || 0, confirmed: a.confirmed || 0, completed: a.completed || 0, cancelled: a.cancelled || 0,
    grossPaise: g, discountPaise: d, refundsPaise: r, netOrderValuePaise: g - d - r, netCollectedPaise: (a.collectedPaise || 0) - r,
    averageOrderValuePaise: a.validOrders ? Math.round((g - d) / a.validOrders) : 0,
  };
}

async function sales(q) {
  const { from, to } = range(q);
  const fmt = GROUP[q.groupBy] || GROUP.day;
  return Order.aggregate([
    { $match: { createdAt: { $gte: from, $lt: to }, orderStatus: { $in: REVENUE_STATUSES } } },
    { $group: { _id: { $dateToString: { format: fmt, date: '$createdAt', timezone: TZ } }, orders: { $sum: 1 },
      grossPaise: { $sum: { $add: ['$pricingSnapshot.subtotalPaise', '$pricingSnapshot.taxPaise', '$pricingSnapshot.deliveryFeePaise'] } },
      discountPaise: { $sum: '$pricingSnapshot.discountPaise' }, refundsPaise: { $sum: '$refundedPaise' } } },
    { $addFields: { netPaise: { $subtract: [{ $subtract: ['$grossPaise', '$discountPaise'] }, '$refundsPaise'] } } },
    { $sort: { _id: 1 } },
  ]);
}

async function productPerformance(q) {
  const { from, to } = range(q);
  return Order.aggregate([
    { $match: { createdAt: { $gte: from, $lt: to }, orderStatus: { $in: REVENUE_STATUSES } } },
    { $unwind: '$items' },
    { $group: { _id: '$items.productId', name: { $first: '$items.name' }, quantity: { $sum: '$items.quantity' }, revenuePaise: { $sum: '$items.lineTotalPaise' } } },
    { $sort: { quantity: -1 } }, { $limit: 50 },
  ]);
}

async function breakdown(q) {
  const { from, to } = range(q);
  const m = { createdAt: { $gte: from, $lt: to } };
  const [payment, fulfillment, cancellations] = await Promise.all([
    Order.aggregate([{ $match: { ...m, orderStatus: { $in: REVENUE_STATUSES } } }, { $group: { _id: '$paymentMethod', orders: { $sum: 1 }, totalPaise: { $sum: '$pricingSnapshot.totalPaise' } } }]),
    Order.aggregate([{ $match: { ...m, orderStatus: { $in: REVENUE_STATUSES } } }, { $group: { _id: '$orderType', orders: { $sum: 1 }, totalPaise: { $sum: '$pricingSnapshot.totalPaise' } } }]),
    Order.aggregate([{ $match: { ...m, orderStatus: 'cancelled' } }, { $group: { _id: '$cancellationReason', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
  ]);
  return { payment, fulfillment, cancellations };
}

async function dashboard(q) {
  const [s, trend, popular, lowStock, recent] = await Promise.all([
    summary(q), sales(q), productPerformance(q).then((r) => r.slice(0, 5)),
    Inventory.find({ $expr: { $lte: ['$availableQuantity', '$lowStockThreshold'] } }).populate('productId', 'name').limit(10).lean(),
    Order.find().sort({ createdAt: -1 }).limit(8).select('orderNumber customer orderType orderStatus paymentStatus pricingSnapshot createdAt'),
  ]);
  return { summary: s, trend, popular, lowStock, recent };
}

const csvCell = (v) => { const s = v == null ? '' : String(v); return /^[=+\-@]/.test(s) ? `'${s}`.replace(/"/g, '""').replace(/^(.*)$/s, '"$1"') : /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const toCsv = (rows, cols) => [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n');

module.exports = { summary, sales, productPerformance, breakdown, dashboard, toCsv };
