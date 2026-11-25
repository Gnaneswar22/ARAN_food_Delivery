import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { BadgeCheck, ShoppingBag, Tag } from 'lucide-react';
import { useDocumentTitle, useQuote } from '../../hooks';
import { Button, EmptyState, Field, Skeleton } from '../../components/common';
import { CartLine } from '../../components/cart/CartDrawer';
import { formatINR } from '../../utils';

export function PriceSummary({ pricing, orderType }) {
  if (!pricing) return null;
  const row = (l, v, cls = '') => <div className={`flex justify-between py-1.5 text-[15px] ${cls}`}><span className="text-muted">{l}</span><span className="font-medium tabular-nums">{v}</span></div>;
  return (
    <div>
      {row('Subtotal', formatINR(pricing.subtotalPaise))}
      {pricing.discountPaise > 0 && row(`Discount${pricing.couponCode ? ` (${pricing.couponCode})` : ''}`, `− ${formatINR(pricing.discountPaise)}`, '[&_span]:!text-ok')}
      {pricing.taxPaise > 0 && row('Tax', formatINR(pricing.taxPaise))}
      {orderType === 'delivery' && row('Delivery', pricing.deliveryFeePaise ? formatINR(pricing.deliveryFeePaise) : 'Free')}
      <div className="mt-2 flex justify-between border-t border-sand pt-3 text-lg font-extrabold"><span>Total</span><span className="tabular-nums">{formatINR(pricing.totalPaise)}</span></div>
    </div>
  );
}

export function CouponBox({ code, onApply, error, applied }) {
  const [v, setV] = useState('');
  return (
    <div>
      <label className="label" htmlFor="coupon">Promo code</label>
      {applied ? (
        <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center justify-between rounded-xl bg-ok/10 px-4 py-3 text-sm font-semibold text-ok"><span className="flex items-center gap-2"><BadgeCheck className="size-5" />{applied.code} applied</span><button className="text-xs underline" onClick={() => onApply('')}>Remove</button></motion.div>
      ) : (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (v.trim()) onApply(v.trim().toUpperCase()); }}>
          <div className="relative flex-1"><Tag className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" /><input id="coupon" className="field pl-9 uppercase" value={v} onChange={(e) => setV(e.target.value)} placeholder="Enter code" /></div>
          <Button type="submit" variant="dark" disabled={!v.trim()}>Apply</Button>
        </form>
      )}
      {error && !applied && <p role="alert" className="mt-1.5 text-xs text-bad">{error}</p>}
    </div>
  );
}

export default function Cart() {
  useDocumentTitle('Cart');
  const items = useSelector((s) => s.cart.items);
  const [coupon, setCoupon] = useState('');
  const { quote, loading } = useQuote(items, { orderType: 'pickup', couponCode: coupon });
  const lineFor = (i) => quote?.lines?.find((l) => String(l.productId) === i.productId && l.options.map((o) => o.label).join() === (i.options || []).map((o) => o.label).join());
  const blocking = quote?.issues?.some((x) => x.productId);

  if (!items.length) return <div className="container-x py-16"><EmptyState icon={ShoppingBag} title="Your cart is empty" text="Add some dishes and they'll show up here." action={<Button as={Link} to="/menu">Explore menu</Button>} /></div>;
  return (
    <div className="container-x py-8 lg:py-12">
      <h1 className="h-page">Your cart</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_400px]">
        <ul className="card divide-y divide-sand/60 px-4 sm:px-6"><AnimatePresence initial={false}>{items.map((i) => <CartLine key={i.key} item={i} line={lineFor(i)} issue={quote?.issues?.find((x) => x.productId === i.productId)?.message} />)}</AnimatePresence></ul>
        <aside className="card h-fit space-y-5 p-5 sm:p-6 lg:sticky lg:top-24">
          <CouponBox onApply={setCoupon} applied={quote?.coupon} error={quote?.couponError} code={coupon} />
          {loading && !quote ? <Skeleton className="h-32" /> : <PriceSummary pricing={quote?.pricing} orderType="pickup" />}
          <p className="text-xs text-muted">Delivery fee is added at checkout based on your address. Prices are verified by our server.</p>
          <Button as={Link} to={`/checkout${coupon && quote?.coupon ? `?coupon=${coupon}` : ''}`} size="lg" className="w-full" disabled={blocking} aria-disabled={blocking}>Proceed to checkout</Button>
          {blocking && <p className="text-xs text-bad" role="alert">Please resolve the unavailable items above to continue.</p>}
        </aside>
      </div>
    </div>
  );
}
