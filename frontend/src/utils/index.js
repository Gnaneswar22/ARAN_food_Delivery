export const formatINR = (paise = 0) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(paise / 100);

export const toPaise = (rupees) => Math.round(Number(rupees || 0) * 100);
export const toRupees = (paise) => (paise ?? 0) / 100;

export const fmtDate = (d, opts = { dateStyle: 'medium', timeStyle: 'short' }) => (d ? new Intl.DateTimeFormat('en-IN', opts).format(new Date(d)) : '—');

export const cx = (...a) => a.filter(Boolean).join(' ');

export const STATUS_LABEL = {
  pending_payment: 'Awaiting payment', placed: 'Placed', confirmed: 'Confirmed', preparing: 'Preparing', ready: 'Ready',
  out_for_delivery: 'Out for delivery', delivered: 'Delivered', picked_up: 'Picked up', cancelled: 'Cancelled',
};
export const DELIVERY_FLOW = ['placed', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered'];
export const PICKUP_FLOW = ['placed', 'confirmed', 'preparing', 'ready', 'picked_up'];

export const NEXT_STATUS = (o) => {
  const flow = o.orderType === 'pickup' ? PICKUP_FLOW : DELIVERY_FLOW;
  const i = flow.indexOf(o.orderStatus);
  return i >= 0 && i < flow.length - 1 ? flow[i + 1] : null;
};

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export const debounce = (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

// Cart line identity = product + selected options
export const lineKey = (productId, options = []) => `${productId}|${options.map((o) => `${o.groupId}:${o.choiceId}`).sort().join(',')}`;
