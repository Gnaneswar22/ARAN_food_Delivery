import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { Check, Circle, MapPin, Phone, XCircle } from 'lucide-react';
import { api, errMsg, post } from '../../services/api';
import { guestHeaders, guestTokens, payForOrder } from '../../services/payments';
import { getSocket } from '../../services/socket';
import { toast } from '../../store';
import { useAction, useDocumentTitle, useFetch } from '../../hooks';
import { Badge, Button, ConfirmModal, ErrorState, Skeleton } from '../../components/common';
import { DELIVERY_FLOW, PICKUP_FLOW, STATUS_LABEL, cx, fmtDate, formatINR } from '../../utils';

const STATUS_TEXT = {
  pending_payment: 'Waiting for your payment to complete.', placed: 'We have received your order.', confirmed: 'ARAN.co has accepted your order.', preparing: 'Your food is being freshly prepared.',
  ready: 'Your order is ready.', out_for_delivery: 'Your order is on its way.', delivered: 'Delivered. Enjoy your meal!', picked_up: 'Picked up. Enjoy your meal!', cancelled: 'This order was cancelled.',
};

const TrackMap = lazy(() => import('../../components/common/TrackMap'));

export function OrderTimeline({ order }) {
  const flow = order.orderType === 'pickup' ? PICKUP_FLOW : DELIVERY_FLOW;
  const idx = flow.indexOf(order.orderStatus);
  const at = (s) => order.statusHistory?.find((h) => h.status === s)?.at;
  return (
    <ol className="space-y-0" aria-label="Order progress">
      {flow.map((s, i) => {
        const done = idx >= i, current = idx === i;
        return (
          <li key={s} className="relative flex gap-4 pb-7 last:pb-0">
            {i < flow.length - 1 && <span className={cx('absolute left-[15px] top-8 h-[calc(100%-2rem)] w-0.5', idx > i ? 'bg-ok' : 'bg-sand')} aria-hidden />}
            <motion.span initial={false} animate={{ scale: current ? 1.1 : 1 }} className={cx('z-10 grid size-8 shrink-0 place-items-center rounded-full border-2', done ? 'border-ok bg-ok text-white' : 'border-sand bg-white text-sand')}>{done ? <Check className="size-4" /> : <Circle className="size-3" />}</motion.span>
            <div><p className={cx('font-semibold', !done && 'text-muted')}>{STATUS_LABEL[s]}</p>{at(s) && <p className="text-xs text-muted">{fmtDate(at(s))}</p>}{current && <p className="mt-0.5 text-sm text-muted">{STATUS_TEXT[s]}</p>}</div>
          </li>
        );
      })}
    </ol>
  );
}

export default function OrderTracking() {
  const { orderId } = useParams();
  useDocumentTitle('Order');
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);
  const settings = useSelector((s) => s.settings.data);
  const gh = guestHeaders(orderId);
  const [order, setOrder] = useState(null);
  const [state, setState] = useState({ loading: true, error: null });
  const [run, busy] = useAction();
  const [cancelOpen, setCancelOpen] = useState(false);

  const load = async () => {
    try { const r = await api.get(`/orders/${orderId}`, gh); setOrder(r.data.data); setState({ loading: false, error: null }); }
    catch (e) { setState({ loading: false, error: e.response?.status === 404 ? 'We could not find this order. If you ordered as a guest, open it from the same device.' : errMsg(e) }); }
  };
  useEffect(() => { load(); }, [orderId, user?._id]); // eslint-disable-line

  // Real-time updates with polling fallback while the order is active.
  useEffect(() => {
    if (!order) return;
    const sock = getSocket();
    sock.emit('order:subscribe', { orderId, guestToken: guestTokens()[orderId] });
    const on = (p) => p.orderId === orderId && load();
    sock.on('order:updated', on);
    sock.on('connect', () => sock.emit('order:subscribe', { orderId, guestToken: guestTokens()[orderId] }));
    const active = !['delivered', 'picked_up', 'cancelled'].includes(order.orderStatus);
    const poll = active ? setInterval(load, 30000) : null;
    return () => { sock.off('order:updated', on); poll && clearInterval(poll); };
  }, [order?._id, order?.orderStatus]); // eslint-disable-line

  if (state.loading) return <div className="container-x space-y-4 py-10"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-64" /></div>;
  if (state.error) return <div className="container-x py-16"><ErrorState message={state.error} onRetry={load} /></div>;

  const cancelled = order.orderStatus === 'cancelled';
  const awaiting = order.orderStatus === 'pending_payment';
  const retry = async () => { const r = await payForOrder(order, { user }); dispatch(toast(r.status === 'paid' ? 'Payment successful!' : r.message || 'Payment failed', r.status === 'paid' ? 'success' : 'error')); load(); };
  const cancel = async () => { await run(() => post(`/orders/${orderId}/cancel`, null, gh), 'Order cancelled'); setCancelOpen(false); load(); };
  const p = order.pricingSnapshot;
  const addr = order.deliveryAddressSnapshot, pick = order.pickupDetailsSnapshot;
  const contact = settings?.stall?.phone || settings?.brand?.phone;

  return (
    <div className="container-x py-8 lg:py-12">
      <div className="flex flex-wrap items-center gap-3"><h1 className="h-page">Order {order.orderNumber}</h1><Badge tone={cancelled ? 'red' : ['delivered', 'picked_up'].includes(order.orderStatus) ? 'green' : 'orange'}>{STATUS_LABEL[order.orderStatus]}</Badge></div>
      <p className="mt-1 text-sm text-muted">Placed {fmtDate(order.createdAt)} · {order.orderType === 'delivery' ? 'Home delivery' : 'Pickup'}</p>

      {awaiting && order.paymentMethod === 'online' && (
        <div className="mt-6 flex flex-col gap-3 rounded-section border border-brand/30 bg-brand/5 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold">Payment pending</p><p className="text-sm text-muted">Complete payment of {formatINR(p.totalPaise)} to confirm your order. Unpaid orders are released automatically after a short time.</p></div><Button onClick={retry}>Pay now</Button></div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          {order.orderType === 'delivery' && order.deliveryCode && !['delivered', 'cancelled'].includes(order.orderStatus) && order.orderStatus !== 'pending_payment' && (
            <section className="rounded-3xl bg-ink p-6 text-white">
              <p className="text-sm text-white/70">Delivery code — share only when your order arrives</p>
              <p className="mt-1 font-heading text-[44px] font-extrabold leading-none tracking-[0.35em]" aria-label={`Delivery code ${order.deliveryCode.split('').join(' ')}`}>{order.deliveryCode}</p>
              {order.orderStatus === 'out_for_delivery' && order.deliveryPartnerId?.lastLocation?.lat != null && <a href={`https://www.google.com/maps?q=${order.deliveryPartnerId.lastLocation.lat},${order.deliveryPartnerId.lastLocation.lng}`} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-bold"><MapPin className="size-4" />See rider's live location · updated {fmtDate(order.deliveryPartnerId.lastLocation.at, { timeStyle: 'short' })}</a>}
            </section>
          )}          {order.orderStatus === 'out_for_delivery' && order.deliveryPartnerId?.lastLocation?.lat != null && (
            <section className="overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-sand/60">
              <Suspense fallback={<div className="skeleton h-72" />}><TrackMap className="h-72 w-full sm:h-80" rider={order.deliveryPartnerId.lastLocation} destination={order.deliveryAddressSnapshot?.lat != null ? { lat: order.deliveryAddressSnapshot.lat, lng: order.deliveryAddressSnapshot.lng } : undefined} /></Suspense>
              <p className="px-5 py-3 text-sm text-muted"><strong className="text-ink">{order.deliveryPartnerId.name}</strong> is on the way · position updated {fmtDate(order.deliveryPartnerId.lastLocation.at, { timeStyle: 'medium' })}</p>
            </section>
          )}
          <section className="card p-6">
            <h2 className="mb-5 text-lg font-bold">Status</h2>
            {cancelled ? (
              <div className="flex gap-3 rounded-xl bg-bad/10 p-4"><XCircle className="size-6 shrink-0 text-bad" /><div><p className="font-bold text-bad">Order cancelled</p>{order.cancellationReason && <p className="text-sm">Reason: {order.cancellationReason}</p>}{order.paymentMethod === 'online' && ['paid', 'refunded', 'partially_refunded'].includes(order.paymentStatus) && <p className="mt-1 text-sm text-muted">{order.paymentStatus === 'paid' ? 'Your refund is being processed.' : `Refunded ${formatINR(order.refundedPaise)}. It can take 5–7 working days to reach your account.`}</p>}</div></div>
            ) : awaiting ? <p className="text-sm text-muted">Your order will start once payment is confirmed.</p> : <OrderTimeline order={order} />}
          </section>
          <section className="card p-6">
            <h2 className="mb-3 text-lg font-bold">{order.orderType === 'delivery' ? 'Delivery details' : 'Pickup details'}</h2>
            {order.orderType === 'delivery' && addr && <p className="flex gap-2 text-sm"><MapPin className="size-5 shrink-0 text-brand" />{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}, {addr.city} – {addr.pincode}</p>}
            {order.orderType === 'pickup' && <p className="flex gap-2 text-sm"><MapPin className="size-5 shrink-0 text-brand" /><span>{pick?.address || 'ARAN.co'}<br />{pick?.slot ? `Slot: ${pick.slot}` : `Ready in about ${pick?.prepMinutes || 20} minutes after confirmation`}</span></p>}
            {order.deliveryPartnerId && <p className="mt-3 text-sm"><strong>Delivery partner:</strong> {order.deliveryPartnerId.name} · <a className="text-brand" href={`tel:${order.deliveryPartnerId.phone}`}>{order.deliveryPartnerId.phone}</a></p>}
            {contact && <p className="mt-3 flex items-center gap-2 text-sm text-muted"><Phone className="size-4" />Need help? <a className="font-semibold text-brand" href={`tel:${contact}`}>{contact}</a></p>}
          </section>
        </div>
        <aside className="card h-fit p-6">
          <h2 className="mb-3 text-lg font-bold">Items</h2>
          <ul className="divide-y divide-sand/60 text-sm">{order.items.map((i, k) => <li key={k} className="flex justify-between gap-3 py-2.5"><span><strong>{i.quantity}×</strong> {i.name}{i.options?.length > 0 && <span className="block text-xs text-muted">{i.options.map((o) => o.label).join(', ')}</span>}</span><span className="tabular-nums">{formatINR(i.lineTotalPaise)}</span></li>)}</ul>
          <div className="mt-3 space-y-1 border-t border-sand pt-3 text-sm">
            <Row l="Subtotal" v={formatINR(p.subtotalPaise)} />{p.discountPaise > 0 && <Row l={`Discount ${p.couponCode || ''}`} v={`− ${formatINR(p.discountPaise)}`} />}{p.taxPaise > 0 && <Row l="Tax" v={formatINR(p.taxPaise)} />}{order.orderType === 'delivery' && <Row l="Delivery" v={p.deliveryFeePaise ? formatINR(p.deliveryFeePaise) : 'Free'} />}
            <div className="flex justify-between pt-2 text-base font-extrabold"><span>Total</span><span>{formatINR(p.totalPaise)}</span></div>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-lg bg-cream px-3 py-2 text-sm"><span className="text-muted">{order.paymentMethod === 'cod' ? 'Cash on delivery' : 'Online payment'}</span><Badge tone={order.paymentStatus === 'paid' ? 'green' : order.paymentStatus === 'failed' ? 'red' : 'gray'}>{order.paymentStatus.replace('_', ' ')}</Badge></div>
          {user && ['pending_payment', 'placed'].includes(order.orderStatus) && String(order.userId) === String(user.id) && <Button variant="outline" className="mt-4 w-full" onClick={() => setCancelOpen(true)}>Cancel order</Button>}
          <Button as={Link} to="/menu" variant="soft" className="mt-3 w-full">Order again</Button>
        </aside>
      </div>
      <ConfirmModal open={cancelOpen} onClose={() => setCancelOpen(false)} onConfirm={cancel} loading={busy} danger title="Cancel this order?" text="This can't be undone. If you've paid online, a refund will be initiated." confirmLabel="Yes, cancel order" />
    </div>
  );
}
const Row = ({ l, v }) => <div className="flex justify-between"><span className="text-muted">{l}</span><span className="tabular-nums">{v}</span></div>;
