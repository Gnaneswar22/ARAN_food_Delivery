import { useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Gift, Heart, LogOut, MapPin, Package, Star, Trash2, User } from 'lucide-react';
import { api, del, errMsg, patch, post } from '../../services/api';
import { logoutThunk, setUser, toast } from '../../store';
import { resetSocket } from '../../services/socket';
import { useAction, useDocumentTitle, useFetch } from '../../hooks';
import { Badge, Button, Checkbox, EmptyState, ErrorState, Field, Modal, Pagination, Skeleton } from '../../components/common';
import ProductCard from '../../components/products/ProductCard';
import { STATUS_LABEL, cx, fmtDate, formatINR } from '../../utils';

function Profile() {
  const user = useSelector((s) => s.auth.user);
  const dispatch = useDispatch();
  const [run, busy] = useAction();
  const { register, handleSubmit, formState: { errors, isDirty } } = useForm({ resolver: zodResolver(z.object({ name: z.string().trim().min(2), phone: z.string().regex(/^[6-9]\d{9}$/, '10-digit mobile number').optional().or(z.literal('')), marketingConsent: z.boolean().optional() })), defaultValues: { name: user.name, phone: user.phone || '', marketingConsent: !!user.marketingConsent } });
  const pw = useForm({ resolver: zodResolver(z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).regex(/[A-Za-z]/, 'Include a letter').regex(/\d/, 'Include a number') })) });
  return (
    <div className="space-y-6">
      <form className="card space-y-4 p-6" onSubmit={handleSubmit((v) => run(async () => { const r = await patch('/account/me', { ...v, phone: v.phone || undefined }); dispatch(setUser(r.data)); }, 'Profile updated'))}>
        <h2 className="text-lg font-bold">Profile</h2>
        <Field label="Name" error={errors.name?.message} {...register('name')} />
        <Field label="Email" value={user.email || ''} disabled readOnly />
        <Field label="Mobile number" inputMode="numeric" maxLength={10} error={errors.phone?.message} hint={user.isPhoneVerified ? '✓ Verified by OTP' : 'Not verified'} readOnly={user.isPhoneVerified} {...register('phone')} />
        <Checkbox label="Send me offers and updates" {...register('marketingConsent')} />
        <Button type="submit" loading={busy} disabled={!isDirty}>Save changes</Button>
      </form>
      <form className="card space-y-4 p-6" onSubmit={pw.handleSubmit((v) => run(async () => { await post('/auth/change-password', v); pw.reset(); }, 'Password changed'))}>
        <h2 className="text-lg font-bold">Change password</h2>
        <Field label="Current password" type="password" autoComplete="current-password" {...pw.register('currentPassword')} />
        <Field label="New password" type="password" autoComplete="new-password" error={pw.formState.errors.newPassword?.message} {...pw.register('newPassword')} />
        <Button type="submit" variant="dark" loading={busy}>Update password</Button>
      </form>
    </div>
  );
}

function Orders() {
  const [page, setPage] = useState(1);
  const { data, meta, loading, error, reload } = useFetch('/orders', { page, limit: 10 });
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading) return <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>;
  if (!data.length) return <EmptyState icon={Package} title="No orders yet" text="Your orders will appear here." action={<Button as={Link} to="/menu">Browse menu</Button>} />;
  return (
    <div>
      <ul className="space-y-3">{data.map((o) => (
        <li key={o._id}><Link to={`/orders/${o._id}`} className="card flex items-center justify-between gap-4 p-4 transition-shadow hover:shadow-lift">
          <div><p className="font-bold">{o.orderNumber}</p><p className="text-sm text-muted">{fmtDate(o.createdAt)} · {o.items.length} item{o.items.length > 1 ? 's' : ''} · {o.orderType}</p></div>
          <div className="text-right"><p className="font-bold tabular-nums">{formatINR(o.pricingSnapshot.totalPaise)}</p><Badge tone={o.orderStatus === 'cancelled' ? 'red' : ['delivered', 'picked_up'].includes(o.orderStatus) ? 'green' : 'orange'}>{STATUS_LABEL[o.orderStatus]}</Badge></div>
        </Link></li>))}</ul>
      <Pagination meta={meta} onPage={setPage} />
    </div>
  );
}

const addrSchema = z.object({ label: z.string().optional(), line1: z.string().min(3, 'Required'), line2: z.string().optional(), landmark: z.string().optional(), city: z.string().min(2, 'Required'), pincode: z.string().regex(/^\d{6}$/, '6-digit PIN code') });
function Addresses() {
  const { data, loading, error, reload } = useFetch('/account/addresses');
  const [open, setOpen] = useState(false);
  const [run, busy] = useAction();
  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(addrSchema) });
  if (error) return <ErrorState message={error} onRetry={reload} />;
  return (
    <div>
      <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">Saved addresses</h2><Button size="sm" onClick={() => setOpen(true)}>Add address</Button></div>
      {loading ? <Skeleton className="h-28" /> : !data.length ? <EmptyState icon={MapPin} title="No saved addresses" text="Add one to speed up checkout." /> : (
        <ul className="grid gap-3 sm:grid-cols-2">{data.map((a) => <li key={a._id} className="card p-4 text-sm"><div className="mb-1 flex items-center justify-between"><strong>{a.label}</strong>{a.isDefault && <Badge tone="orange">Default</Badge>}</div><p>{a.line1}{a.line2 ? `, ${a.line2}` : ''}<br />{a.city} – {a.pincode}</p>{a.landmark && <p className="text-muted">Landmark: {a.landmark}</p>}<button className="mt-3 flex items-center gap-1 text-bad" onClick={() => run(async () => { await del(`/account/addresses/${a._id}`); reload(); }, 'Address removed')}><Trash2 className="size-4" />Remove</button></li>)}</ul>)}
      <Modal open={open} onClose={() => setOpen(false)} title="Add address">
        <form className="space-y-3" onSubmit={handleSubmit((v) => run(async () => { await post('/account/addresses', v); reset(); setOpen(false); reload(); }, 'Address saved'))}>
          <Field label="Label" placeholder="Home, Work…" {...register('label')} /><Field label="Address line 1" error={errors.line1?.message} {...register('line1')} /><Field label="Address line 2" {...register('line2')} /><Field label="Landmark" {...register('landmark')} />
          <div className="grid grid-cols-2 gap-3"><Field label="City" error={errors.city?.message} {...register('city')} /><Field label="PIN code" inputMode="numeric" maxLength={6} error={errors.pincode?.message} {...register('pincode')} /></div>
          <Button type="submit" className="w-full" loading={busy}>Save address</Button>
        </form>
      </Modal>
    </div>
  );
}

function Wishlist() {
  const { data, loading, error, reload } = useFetch('/account/wishlist');
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading) return <Skeleton className="h-64" />;
  if (!data.length) return <EmptyState icon={Heart} title="Your wishlist is empty" text="Tap the heart on any dish to save it." action={<Button as={Link} to="/menu">Browse menu</Button>} />;
  return <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{data.map((p) => <ProductCard key={p._id} product={p} />)}</div>;
}

function MyReviews() {
  const { data, loading, error, reload } = useFetch('/account/reviews');
  const orders = useFetch('/orders', { limit: 20 });
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [orderId, setOrderId] = useState('');
  const [comment, setComment] = useState('');
  const [run, busy] = useAction();
  const completed = orders.data?.filter((o) => ['delivered', 'picked_up'].includes(o.orderStatus)) || [];
  if (error) return <ErrorState message={error} onRetry={reload} />;
  return (
    <div>
      <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">My reviews</h2>{completed.length > 0 && <Button size="sm" onClick={() => { setOrderId(completed[0]._id); setOpen(true); }}>Write a review</Button>}</div>
      {loading ? <Skeleton className="h-24" /> : !data.length ? <EmptyState icon={Star} title="No reviews yet" text="After an order is complete you can share your feedback." /> : <ul className="space-y-3">{data.map((r) => <li key={r._id} className="card p-4 text-sm"><div className="flex items-center justify-between"><span className="font-semibold">{r.productId?.name || 'Order review'}</span><Badge tone={r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'red' : 'gray'}>{r.status}</Badge></div><p className="my-1 text-brand">{'★'.repeat(r.rating)}</p><p>{r.comment}</p></li>)}</ul>}
      <Modal open={open} onClose={() => setOpen(false)} title="Write a review">
        <div className="space-y-3">
          <Field as="select" label="Order" value={orderId} onChange={(e) => setOrderId(e.target.value)}>{completed.map((o) => <option key={o._id} value={o._id}>{o.orderNumber} · {fmtDate(o.createdAt, { dateStyle: 'medium' })}</option>)}</Field>
          <div><span className="label">Rating</span><div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} stars`} aria-pressed={rating >= n} className={cx('text-3xl leading-none', rating >= n ? 'text-brand' : 'text-sand')}>★</button>)}</div></div>
          <Field as="textarea" rows={3} label="Comment" maxLength={600} value={comment} onChange={(e) => setComment(e.target.value)} />
          <Button className="w-full" loading={busy} onClick={() => run(async () => { await post('/account/reviews', { orderId, rating, comment }); setOpen(false); setComment(''); reload(); }, 'Thanks! Your review will appear after approval.')}>Submit review</Button>
        </div>
      </Modal>
    </div>
  );
}

function Rewards() {
  const { data, loading, error, reload } = useFetch('/account/loyalty');
  const dispatch = useDispatch();
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading) return <Skeleton className="h-64" />;
  if (!data.enabled) return <EmptyState icon={Gift} title="Rewards are not available right now" />;
  const link = `${window.location.origin}/?ref=${data.referralCode}`;
  const share = async () => {
    const text = `Order fresh food from ARAN.co. Use my code ${data.referralCode} and we both earn ${data.referralBonusPoints} reward points!`;
    try { if (navigator.share) await navigator.share({ title: 'ARAN.co', text, url: link }); else { await navigator.clipboard.writeText(`${text} ${link}`); dispatch(toast('Invite link copied')); } } catch { /* cancelled */ }
  };
  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-ink p-6 text-white"><p className="text-sm text-white/70">Your ARAN.co points</p><p className="font-heading text-[56px] font-extrabold leading-none">{data.points}</p><p className="mt-1 text-sm text-white/70">Worth {formatINR(data.points * data.pointValuePaise)} off your next order</p></div>
      <div className="card p-6"><h2 className="text-lg font-bold">Invite friends, earn together</h2><p className="mt-1 text-sm text-muted">When a friend signs up with your code and completes their first order, you both get {data.referralBonusPoints} points.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3"><span className="rounded-xl border-2 border-dashed border-brand bg-brand/5 px-5 py-3 font-mono text-xl font-bold tracking-[0.25em]">{data.referralCode}</span><Button onClick={share}>Share invite</Button></div></div>
      <div className="card p-6"><h2 className="mb-3 text-lg font-bold">Points history</h2>{data.history.length ? <ul className="divide-y divide-sand/60 text-sm">{data.history.map((h) => <li key={h._id} className="flex items-center justify-between gap-3 py-2.5"><span><span className="block">{h.reason}</span><span className="text-xs text-muted">{fmtDate(h.createdAt)}</span></span><strong className={h.points > 0 ? 'text-ok' : 'text-bad'}>{h.points > 0 ? '+' : ''}{h.points}</strong></li>)}</ul> : <p className="text-sm text-muted">Order and earn — your points will show up here.</p>}</div>
    </div>
  );
}
const TABS = [['', 'Profile', User], ['orders', 'Orders', Package], ['addresses', 'Addresses', MapPin], ['rewards', 'Rewards', Gift], ['wishlist', 'Wishlist', Heart], ['reviews', 'Reviews', Star]];
export default function Account() {
  useDocumentTitle('My account');
  const user = useSelector((s) => s.auth.user);
  const dispatch = useDispatch();
  const nav = useNavigate();
  if (!user) return <Navigate to="/login" state={{ from: '/account' }} replace />;
  const logout = async () => { await dispatch(logoutThunk()); resetSocket(); nav('/'); };
  return (
    <div className="container-x py-8 lg:py-12">
      <div className="mb-6 flex items-center justify-between"><div><h1 className="h-page">Hi, {user.name.split(' ')[0]}</h1><p className="text-sm text-muted">{user.email}</p></div><Button variant="outline" onClick={logout}><LogOut className="size-4" />Sign out</Button></div>
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="no-scrollbar flex gap-2 overflow-x-auto lg:flex-col" aria-label="Account">{TABS.map(([to, label, Icon]) => <NavLink key={to} to={`/account/${to}`} end className={({ isActive }) => cx('flex h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold', isActive ? 'bg-brand text-white' : 'bg-white hover:bg-sand/50')}><Icon className="size-4" />{label}</NavLink>)}</nav>
        <div><Routes><Route index element={<Profile />} /><Route path="orders" element={<Orders />} /><Route path="addresses" element={<Addresses />} /><Route path="rewards" element={<Rewards />} /><Route path="wishlist" element={<Wishlist />} /><Route path="reviews" element={<MyReviews />} /></Routes></div>
      </div>
    </div>
  );
}
