import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, Banknote, CreditCard, MapPin, Plus, Store, Truck } from 'lucide-react';
import { useDocumentTitle, useFetch, useQuote } from '../../hooks';
import { post, errMsg } from '../../services/api';
import { payForOrder, saveGuestToken } from '../../services/payments';
import { clearCart, toast } from '../../store';
import { Button, Checkbox, EmptyState, Field } from '../../components/common';
import { CouponBox, PriceSummary } from './Cart';
import PhoneAuth from '../../components/auth/PhoneAuth';
import AddressSearch from '../../components/common/AddressSearch';
import { cx, formatINR, uid } from '../../utils';

const customerSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name'),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  email: z.string().trim().email('Enter a valid email').optional().or(z.literal('')),
});
const addressSchema = z.object({
  line1: z.string().trim().min(3, 'Enter your address'), line2: z.string().optional(), landmark: z.string().optional(),
  city: z.string().trim().min(2, 'Enter your city'), pincode: z.string().trim().regex(/^\d{6}$/, 'Enter a 6-digit PIN code'),
});

const Step = ({ n, title, children }) => (
  <section className="card p-5 sm:p-6"><h2 className="mb-4 flex items-center gap-3 text-lg font-bold"><span className="grid size-7 place-items-center rounded-full bg-brand text-sm text-white">{n}</span>{title}</h2>{children}</section>
);
const Choice = ({ on, onClick, icon: Icon, title, text, disabled }) => (
  <button type="button" disabled={disabled} onClick={onClick} aria-pressed={on} className={cx('flex flex-1 items-start gap-3 rounded-xl border p-4 text-left transition-colors disabled:opacity-50', on ? 'border-brand bg-brand/5 ring-1 ring-brand' : 'border-sand bg-white hover:border-brand/50')}>
    <Icon className={cx('mt-0.5 size-5 shrink-0', on ? 'text-brand' : 'text-muted')} /><span><span className="block font-semibold">{title}</span><span className="block text-xs text-muted">{text}</span></span>
  </button>
);

export default function Checkout() {
  useDocumentTitle('Checkout');
  const nav = useNavigate();
  const dispatch = useDispatch();
  const [sp] = useSearchParams();
  const items = useSelector((s) => s.cart.items);
  const user = useSelector((s) => s.auth.user);
  const settings = useSelector((s) => s.settings.data);
  const idem = useRef(uid());

  const [orderType, setOrderType] = useState('delivery');
  const [addrId, setAddrId] = useState(null); // saved address id, or 'new'
  const [saveAddr, setSaveAddr] = useState(true);
  const [coupon, setCoupon] = useState(sp.get('coupon') || '');
  const [payment, setPayment] = useState('online');
  const onlineOk = settings?.payments?.onlineEnabled !== false, codOk = settings?.payments?.codEnabled !== false;
  useEffect(() => { if (settings && payment === 'online' && !onlineOk && codOk) setPayment('cod'); if (settings && payment === 'cod' && !codOk && onlineOk) setPayment('online'); }, [settings, onlineOk, codOk, payment]);
  const [slot, setSlot] = useState('');
  const [instructions, setInstructions] = useState('');
  const [coords, setCoords] = useState({});
  const [redeem, setRedeem] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');

  const saved = useFetch('/account/addresses', null, { enabled: !!user });
  useEffect(() => { if (saved.data?.length && addrId === null) setAddrId((saved.data.find((a) => a.isDefault) || saved.data[0])._id); else if (saved.data && !saved.data.length && addrId === null) setAddrId('new'); }, [saved.data]); // eslint-disable-line
  useEffect(() => { if (!user && addrId === null) setAddrId('new'); }, [user, addrId]);

  const cust = useForm({ resolver: zodResolver(customerSchema), mode: 'onBlur', defaultValues: { name: '', phone: '', email: '' } });
  const addrForm = useForm({ resolver: zodResolver(addressSchema), mode: 'onBlur', defaultValues: { line1: '', line2: '', landmark: '', city: '', pincode: '' } });
  useEffect(() => { if (user) cust.reset({ name: user.name && user.name !== 'Customer' ? user.name : '', phone: user.phone || '', email: user.email || '' }); }, [user]); // eslint-disable-line

  const watchedAddr = addrForm.watch();
  const chosenAddress = useMemo(() => {
    if (orderType !== 'delivery') return undefined;
    if (addrId && addrId !== 'new') return saved.data?.find((a) => a._id === addrId);
    return watchedAddr.pincode?.length === 6 ? { ...watchedAddr, ...coords } : undefined;
  }, [orderType, addrId, saved.data, watchedAddr.pincode, coords]); // eslint-disable-line

  const loyalty = useFetch('/account/loyalty', null, { enabled: !!user });
  const { quote, loading: quoting, reload } = useQuote(items, { orderType, address: chosenAddress, couponCode: coupon, redeemPoints: redeem });
  const pickAddress = (r) => { const set = (k, v) => v && addrForm.setValue(k, v, { shouldValidate: true }); set('line1', r.line1); set('city', r.city); set('pincode', r.pincode); setCoords(r.lat != null ? { lat: r.lat, lng: r.lng } : {}); };
  const pickup = settings?.pickup;
  const deliveryOff = settings && settings.delivery?.enabled === false;
  const closed = settings && !settings.status?.open;
  const outOfArea = orderType === 'delivery' && quote && !quote.serviceable?.ok;
  const blockers = quote?.issues?.length > 0;
  const needsLogin = !user && settings && settings.guestCheckout === false;

  if (!items.length) return <div className="container-x py-16"><EmptyState title="Your cart is empty" text="Add dishes before checking out." action={<Button as={Link} to="/menu">Explore menu</Button>} /></div>;

  const placeOrder = async () => {
    setError('');
    const okC = await cust.trigger();
    const okA = orderType === 'delivery' && addrId === 'new' ? await addrForm.trigger() : true;
    if (!okC || !okA) return setError('Please fix the highlighted fields.');
    if (orderType === 'delivery' && !chosenAddress) return setError('Please choose a delivery address.');
    setPlacing(true);
    try {
      const c = cust.getValues();
      const address = orderType === 'delivery' ? (({ _id, userId, isDefault, createdAt, updatedAt, __v, ...a }) => a)(chosenAddress) : undefined;
      if (address && addrId === 'new' && user && saveAddr) post('/account/addresses', address).catch(() => {});
      const { data: order } = await post('/orders', {
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, options: (i.options || []).map((o) => ({ groupId: o.groupId, choiceId: o.choiceId })), note: i.note })),
        orderType, address, deliveryInstructions: instructions || undefined, pickupSlot: orderType === 'pickup' ? slot || undefined : undefined,
        customer: { name: c.name, phone: c.phone, email: c.email || undefined }, couponCode: quote?.coupon?.code, redeemPoints: redeem || undefined, paymentMethod: payment, idempotencyKey: idem.current,
      });
      saveGuestToken(order._id, order.guestToken);
      if (payment === 'online') {
        const r = await payForOrder(order, { user });
        if (r.status === 'paid') { dispatch(clearCart()); dispatch(toast('Payment successful! Your order is placed.')); }
        else { dispatch(toast(r.message || 'Payment not completed. You can retry from your order page.', 'error')); }
        if (r.status === 'paid') { nav(`/orders/${order._id}`, { replace: true }); return; }
        dispatch(clearCart()); // order exists (stock reserved) — retry lives on the order page
        nav(`/orders/${order._id}`, { replace: true });
        return;
      }
      dispatch(clearCart());
      dispatch(toast('Order placed!'));
      nav(`/orders/${order._id}`, { replace: true });
    } catch (e) {
      setError(errMsg(e));
      idem.current = e.response?.status >= 500 || !e.response ? idem.current : uid(); // keep key only for ambiguous failures
      reload();
    } finally { setPlacing(false); }
  };

  return (
    <div className="container-x py-8 lg:py-12">
      <h1 className="h-page">Checkout</h1>
      {closed && <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-bad/10 p-4 text-sm text-bad"><AlertTriangle className="size-5 shrink-0" />{settings.status.reason} Orders can't be placed right now.</div>}
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_400px]">
        <div className="space-y-5">
          <Step n={1} title="How would you like your order?">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Choice on={orderType === 'delivery'} onClick={() => setOrderType('delivery')} icon={Truck} title="Home delivery" text={deliveryOff ? 'Currently unavailable' : 'Delivered to your door'} disabled={deliveryOff} />
              <Choice on={orderType === 'pickup'} onClick={() => setOrderType('pickup')} icon={Store} title="Pickup from ARAN.co" text={`Ready in about ${quote?.estimatedPrepMinutes || pickup?.prepMinutes || 20} min`} disabled={pickup?.enabled === false} />
            </div>

            {orderType === 'delivery' ? (
              <div className="mt-5 space-y-3">
                {saved.data?.map((a) => (
                  <label key={a._id} className={cx('flex cursor-pointer items-start gap-3 rounded-xl border p-4', addrId === a._id ? 'border-brand bg-brand/5' : 'border-sand')}>
                    <input type="radio" name="addr" className="mt-1 accent-[var(--color-brand)]" checked={addrId === a._id} onChange={() => setAddrId(a._id)} />
                    <span className="text-sm"><span className="font-semibold">{a.label}</span><br />{a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city} – {a.pincode}{a.landmark && <><br /><span className="text-muted">Landmark: {a.landmark}</span></>}</span>
                  </label>
                ))}
                {user && saved.data?.length > 0 && <button type="button" onClick={() => setAddrId('new')} className={cx('flex w-full items-center gap-2 rounded-xl border border-dashed p-4 text-sm font-semibold', addrId === 'new' ? 'border-brand text-brand' : 'border-sand text-muted')}><Plus className="size-4" />Add a new address</button>}
                {addrId === 'new' && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2"><AddressSearch onPick={pickAddress} />{coords.lat != null && <p className="mt-1 text-xs text-ok">✓ Location pinned — helps your rider find you</p>}</div>
                    <Field className="sm:col-span-2" label="Address line 1" autoComplete="address-line1" error={addrForm.formState.errors.line1?.message} {...addrForm.register('line1')} />
                    <Field label="Address line 2 (optional)" autoComplete="address-line2" {...addrForm.register('line2')} />
                    <Field label="Landmark (optional)" {...addrForm.register('landmark')} />
                    <Field label="City" autoComplete="address-level2" error={addrForm.formState.errors.city?.message} {...addrForm.register('city')} />
                    <Field label="PIN code" inputMode="numeric" maxLength={6} autoComplete="postal-code" error={addrForm.formState.errors.pincode?.message} {...addrForm.register('pincode')} />
                    {user && <div className="sm:col-span-2"><Checkbox checked={saveAddr} onChange={(e) => setSaveAddr(e.target.checked)} label="Save this address to my account" /></div>}
                  </div>
                )}
                {outOfArea && (
                  <div role="alert" className="flex flex-col gap-3 rounded-xl bg-bad/10 p-4 text-sm text-bad sm:flex-row sm:items-center sm:justify-between"><span className="flex gap-2"><MapPin className="size-5 shrink-0" />{quote.serviceable.message}</span>{pickup?.enabled !== false && <Button size="sm" variant="outline" onClick={() => setOrderType('pickup')}>Switch to pickup</Button>}</div>
                )}
                <Field as="textarea" rows={2} label="Delivery instructions (optional)" maxLength={300} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Gate code, floor, call on arrival…" />
              </div>
            ) : (
              <div className="mt-5 space-y-3 rounded-xl bg-cream p-4 text-sm">
                <p className="flex gap-2"><MapPin className="size-5 shrink-0 text-brand" /><span><strong>Pickup address</strong><br />{pickup?.address || settings?.stall?.address || 'Address will be shown on your order confirmation.'}</span></p>
                {pickup?.slots?.length > 0 && (
                  <div><label className="label" htmlFor="slot">Pickup slot</label><select id="slot" className="field" value={slot} onChange={(e) => setSlot(e.target.value)}><option value="">As soon as ready</option>{pickup.slots.map((s) => <option key={s}>{s}</option>)}</select></div>
                )}
              </div>
            )}
          </Step>

          {needsLogin ? (
            <Step n={2} title="Verify your mobile number"><PhoneAuth title="Quick sign-in to place your order" subtitle="We verify your number so the rider and the kitchen can reach you." /></Step>
          ) : (
          <Step n={2} title="Your details">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field className="sm:col-span-2" label="Full name" autoComplete="name" error={cust.formState.errors.name?.message} {...cust.register('name')} />
              <Field label="Mobile number" inputMode="numeric" maxLength={10} autoComplete="tel-national" error={cust.formState.errors.phone?.message} {...cust.register('phone')} />
              <Field label="Email (optional)" type="email" autoComplete="email" error={cust.formState.errors.email?.message} {...cust.register('email')} />
            </div>
            {!user && <p className="mt-3 text-sm text-muted">Checking out as a guest. <Link className="font-semibold text-brand" to="/login" state={{ from: '/checkout' }}>Sign in</Link> to save addresses and track orders in your account.</p>}
          </Step>
          )}

          <Step n={3} title="Payment method">
            <div className="flex flex-col gap-3 sm:flex-row">
              {onlineOk && <Choice on={payment === 'online'} onClick={() => setPayment('online')} icon={CreditCard} title="Pay online" text="UPI, cards, net banking via Razorpay" />}
              {codOk && <Choice on={payment === 'cod'} onClick={() => setPayment('cod')} icon={Banknote} title="Cash on delivery" text={orderType === 'pickup' ? 'Pay when you collect' : 'Pay when it arrives'} />}
            </div>
            {!onlineOk && !codOk && <p role="alert" className="mt-3 text-sm text-bad">No payment method is available right now. Please try again later.</p>}
          </Step>
        </div>

        <aside className="card h-fit space-y-5 p-5 sm:p-6 lg:sticky lg:top-24">
          <h2 className="text-lg font-bold">Order summary</h2>
          <ul className="space-y-2.5 text-sm">{(quote?.lines || items).map((l, i) => <li key={i} className="flex justify-between gap-3"><span><span className="font-semibold">{l.quantity}×</span> {l.name}{l.options?.length > 0 && <span className="block text-xs text-muted">{l.options.map((o) => o.label).join(', ')}</span>}</span><span className="tabular-nums">{formatINR((l.unitPricePaise || 0) * l.quantity)}</span></li>)}</ul>
          {user && loyalty.data?.enabled && loyalty.data.points > 0 && (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-sand bg-cream p-3.5 text-sm"><input type="checkbox" checked={redeem} onChange={(e) => setRedeem(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-brand)]" /><span><strong>Use my ARAN.co points</strong><span className="block text-muted">You have {loyalty.data.points} points (worth {formatINR(loyalty.data.points * loyalty.data.pointValuePaise)}){redeem && quote?.pricing.pointsRedeemed > 0 && <> · using {quote.pricing.pointsRedeemed} to save {formatINR(quote.pricing.loyaltyDiscountPaise)}</>}. Up to 20% of an order can be paid with points.</span></span></label>
          )}
          <CouponBox onApply={setCoupon} applied={quote?.coupon} error={quote?.couponError} code={coupon} />
          <PriceSummary pricing={quote?.pricing} orderType={orderType} />
          {quote?.issues?.map((x, i) => <p key={i} role="alert" className="text-sm text-bad">{x.message}</p>)}
          {error && <p role="alert" className="rounded-lg bg-bad/10 p-3 text-sm text-bad">{error}</p>}
          <Button size="lg" className="w-full" loading={placing || (quoting && !quote)} disabled={!quote || blockers || outOfArea || closed || needsLogin} onClick={placeOrder}>
            {payment === 'online' ? `Pay ${quote ? formatINR(quote.pricing.totalPaise) : ''}` : 'Place order'}
          </Button>
          <p className="text-center text-xs text-muted">By placing your order you agree to our <Link to="/terms" className="underline">terms</Link> and <Link to="/refund-policy" className="underline">refund policy</Link>.</p>
        </aside>
      </div>
    </div>
  );
}
