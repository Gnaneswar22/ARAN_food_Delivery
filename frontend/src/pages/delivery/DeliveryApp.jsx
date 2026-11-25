import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AnimatePresence, motion } from 'framer-motion';
import { Banknote, CheckCircle2, LogOut, MapPin, Navigation, Phone, Power } from 'lucide-react';
import { post } from '../../services/api';
import { logoutThunk } from '../../store';
import { resetSocket } from '../../services/socket';
import { useAction, useDocumentTitle, useFetch } from '../../hooks';
import { Badge, Button, EmptyState, ErrorState, Modal, Skeleton } from '../../components/common';
import PhoneAuth from '../../components/auth/PhoneAuth';
import { Logo } from '../../components/layout/CustomerLayout';
import { fmtDate, formatINR } from '../../utils';

/** Streams the rider's real GPS position while "On duty" is switched on. Nothing is sent when off. */
function useLocationSharing(on) {
  const last = useRef(0);
  const [state, setState] = useState('off'); // off | live | denied | unsupported
  useEffect(() => {
    if (!on) { setState('off'); return undefined; }
    if (!navigator.geolocation) { setState('unsupported'); return undefined; }
    const id = navigator.geolocation.watchPosition(
      (pos) => { setState('live'); if (Date.now() - last.current > 12000) { last.current = Date.now(); post('/delivery/location', { lat: pos.coords.latitude, lng: pos.coords.longitude }).catch(() => {}); } },
      (e) => setState(e.code === 1 ? 'denied' : 'off'), { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
    return () => navigator.geolocation.clearWatch(id);
  }, [on]);
  return state;
}

function OrderCard({ o, onChanged }) {
  const [run, busy] = useAction();
  const [code, setCode] = useState('');
  const [open, setOpen] = useState(false);
  const a = o.deliveryAddressSnapshot || {};
  const addr = [a.line1, a.line2, a.landmark && `Landmark: ${a.landmark}`, `${a.city} ${a.pincode}`].filter(Boolean).join(', ');
  const maps = a.lat != null ? `https://www.google.com/maps/dir/?api=1&destination=${a.lat},${a.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;
  const due = o.paymentMethod === 'cod' && o.paymentStatus !== 'paid';
  const out = o.orderStatus === 'out_for_delivery';
  return (
    <motion.li layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-sand/60">
      <div className="flex items-center justify-between"><strong className="font-heading text-lg">{o.orderNumber}</strong><Badge tone={out ? 'orange' : o.orderStatus === 'ready' ? 'green' : 'gray'}>{out ? 'On the way' : o.orderStatus === 'ready' ? 'Ready to collect' : 'Being prepared'}</Badge></div>
      <p className="mt-2 text-sm"><strong>{o.customer?.name}</strong> · <a className="font-semibold text-brand" href={`tel:${o.customer?.phone}`}><Phone className="mr-1 inline size-3.5" />{o.customer?.phone}</a></p>
      <p className="mt-2 flex gap-2 text-sm text-muted"><MapPin className="mt-0.5 size-4 shrink-0 text-brand" />{addr}</p>
      {o.deliveryInstructions && <p className="mt-1 text-sm italic text-muted">“{o.deliveryInstructions}”</p>}
      <p className="mt-2 text-xs text-muted">{o.items.map((i) => `${i.quantity}× ${i.name}`).join(' · ')}</p>
      {due && <p className="mt-3 flex items-center gap-2 rounded-xl bg-brand/10 p-3 text-sm font-bold"><Banknote className="size-5 text-brand" />Collect {formatINR(o.pricingSnapshot.totalPaise)} in cash</p>}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button as="a" href={maps} target="_blank" rel="noreferrer" variant="outline"><Navigation className="size-4" />Navigate</Button>
        {o.orderStatus === 'ready' && <Button loading={busy} onClick={async () => { await run(() => post(`/delivery/orders/${o._id}/pickup`), 'Order picked up. Safe ride!'); onChanged(); }}>Picked up</Button>}
        {out && <Button onClick={() => { setCode(''); setOpen(true); }}>Complete delivery</Button>}
        {!out && o.orderStatus !== 'ready' && <Button disabled variant="soft">Waiting for kitchen</Button>}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Enter customer's delivery code">
        <p className="mb-4 text-sm text-muted">Ask the customer for the 4-digit code shown on their order page.{due && ` Collect ${formatINR(o.pricingSnapshot.totalPaise)} cash first.`}</p>
        <input autoFocus inputMode="numeric" maxLength={4} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} aria-label="Delivery code" className="field text-center font-heading text-3xl font-extrabold tracking-[0.5em]" placeholder="••••" />
        <Button className="mt-4 w-full" size="lg" loading={busy} disabled={code.length !== 4} onClick={async () => { const r = await run(() => post(`/delivery/orders/${o._id}/deliver`, { code }), 'Delivered!'); if (r) { setOpen(false); onChanged(); } }}>Confirm delivery</Button>
      </Modal>
    </motion.li>
  );
}

export default function DeliveryApp() {
  useDocumentTitle('Delivery partner');
  const user = useSelector((s) => s.auth.user);
  const dispatch = useDispatch();
  const nav = useNavigate();
  const [onDuty, setOnDuty] = useState(() => localStorage.getItem('aran_duty') === '1');
  const gps = useLocationSharing(onDuty && user?.role === 'delivery');
  const { data, loading, error, reload } = useFetch('/delivery/orders', null, { enabled: user?.role === 'delivery' });

  useEffect(() => { if (user?.role !== 'delivery') return undefined; const t = setInterval(reload, 20000); return () => clearInterval(t); }, [user, reload]);
  useEffect(() => localStorage.setItem('aran_duty', onDuty ? '1' : '0'), [onDuty]);

  if (user && user.role !== 'delivery') return <Navigate to="/" replace />;
  if (!user) {
    return (
      <div className="grid min-h-dvh place-items-center bg-cream p-4"><div className="card w-full max-w-md p-6 sm:p-8"><div className="mb-5 text-center"><Logo /><p className="mt-2 text-sm font-semibold text-muted">Delivery partner sign-in</p></div><PhoneAuth title="Rider login" subtitle="Use the mobile number registered by the restaurant." onSuccess={() => {}} /></div></div>
    );
  }
  return (
    <div className="min-h-dvh bg-cream pb-10">
      <header className="sticky top-0 z-20 border-b border-sand bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
          <div><Logo className="!text-[22px]" /><p className="text-xs text-muted">{data?.partner?.name || user.name}</p></div>
          <div className="flex items-center gap-2">
            <button onClick={() => setOnDuty((v) => !v)} aria-pressed={onDuty} className={`flex h-10 items-center gap-2 rounded-full px-4 text-sm font-bold ${onDuty ? 'bg-ok text-white' : 'bg-sand text-ink'}`}><Power className="size-4" />{onDuty ? 'On duty' : 'Off duty'}</button>
            <button onClick={async () => { await dispatch(logoutThunk()); resetSocket(); nav('/delivery'); }} className="grid size-10 place-items-center rounded-full hover:bg-sand/60" aria-label="Sign out"><LogOut className="size-5" /></button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-xl space-y-4 px-4 pt-5">
        <AnimatePresence>
          {onDuty && gps === 'live' && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-sm text-ok"><span className="relative flex size-2.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-ok/60" /><span className="relative inline-flex size-2.5 rounded-full bg-ok" /></span>Sharing your live location with customers on active deliveries</motion.p>}
          {onDuty && gps === 'denied' && <p role="alert" className="rounded-xl bg-bad/10 p-3 text-sm text-bad">Location permission is blocked. Enable it in your browser settings so customers can follow their order.</p>}
          {!onDuty && <p className="rounded-xl bg-white p-3 text-sm text-muted">You're off duty — location is not being shared. Switch on duty when you start your shift.</p>}
        </AnimatePresence>
        {error ? <ErrorState message={error} onRetry={reload} /> : loading ? <Skeleton className="h-52" /> : data.active.length === 0 ? <EmptyState icon={CheckCircle2} title="No active deliveries" text="New orders assigned to you will appear here." /> : <ul className="space-y-4">{data.active.map((o) => <OrderCard key={o._id} o={o} onChanged={reload} />)}</ul>}
        {data?.delivered24h?.length > 0 && <section><h2 className="mb-2 mt-6 font-heading text-lg font-bold">Delivered in the last 24h ({data.delivered24h.length})</h2><ul className="divide-y divide-sand rounded-2xl bg-white px-4 text-sm">{data.delivered24h.map((o) => <li key={o._id} className="flex justify-between py-2.5"><span>{o.orderNumber}</span><span className="text-muted">{fmtDate(o.updatedAt, { timeStyle: 'short' })}</span></li>)}</ul></section>}
      </main>
    </div>
  );
}
