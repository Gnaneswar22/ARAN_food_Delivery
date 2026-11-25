import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { ShoppingBag, Trash2, X } from 'lucide-react';
import { formatINR } from '../../utils';
import { removeItem, setCartOpen, setQty } from '../../store';
import { useQuote } from '../../hooks';
import { Button, EmptyState, FoodDot, ProductImage, QtyStepper, ease } from '../common';

export function CartLine({ item, line, issue, compact }) {
  const dispatch = useDispatch();
  const unit = line?.unitPricePaise ?? item.unitPricePaise ?? 0;
  return (
    <motion.li layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0, marginTop: 0 }} transition={{ duration: 0.25, ease }} className="overflow-hidden">
      <div className="flex gap-3 py-3">
        <ProductImage src={line?.image || item.image} alt={item.name} className={compact ? 'size-16 shrink-0 rounded-xl' : 'size-20 shrink-0 rounded-xl'} zoom={false} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 font-semibold leading-snug"><FoodDot type={item.foodType} /><span className="truncate">{item.name}</span></p>
              {item.options?.length > 0 && <p className="mt-0.5 text-xs text-muted">{item.options.map((o) => o.label).join(', ')}</p>}
              {issue && <p className="mt-1 text-xs font-medium text-bad" role="alert">{issue}</p>}
            </div>
            <button onClick={() => dispatch(removeItem(item.key))} className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-bad/10 hover:text-bad" aria-label={`Remove ${item.name}`}><Trash2 className="size-4" /></button>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <QtyStepper size="sm" value={item.quantity} onChange={(q) => dispatch(setQty({ key: item.key, quantity: q }))} />
            <motion.span key={unit * item.quantity} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} className="font-semibold tabular-nums">{formatINR(unit * item.quantity)}</motion.span>
          </div>
        </div>
      </div>
    </motion.li>
  );
}

export default function CartDrawer() {
  const open = useSelector((s) => s.ui.cartOpen);
  const items = useSelector((s) => s.cart.items);
  const dispatch = useDispatch();
  const close = () => dispatch(setCartOpen(false));
  const { quote } = useQuote(open ? items : [], { orderType: 'pickup' });
  const lineFor = (i) => quote?.lines?.find((l) => String(l.productId) === i.productId && l.unitPricePaise != null && l.options.map((o) => o.label).join() === (i.options || []).map((o) => o.label).join());
  const subtotal = quote?.pricing.subtotalPaise ?? items.reduce((a, i) => a + (i.unitPricePaise || 0) * i.quantity, 0);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[65]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          <div className="absolute inset-0 bg-ink/45" onClick={close} aria-hidden />
          <motion.aside role="dialog" aria-modal="true" aria-label="Your cart" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ duration: 0.3, ease }} className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-lift">
            <div className="flex items-center justify-between border-b border-sand/70 px-5 py-4">
              <h2 className="text-xl font-bold">Your cart</h2>
              <button onClick={close} className="grid size-10 place-items-center rounded-full hover:bg-sand/60" aria-label="Close cart"><X className="size-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5">
              {items.length === 0 ? (
                <div className="py-10"><EmptyState icon={ShoppingBag} title="Your cart is empty" text="Add something delicious from our menu." action={<Button as={Link} to="/menu" onClick={close}>Browse menu</Button>} /></div>
              ) : (
                <ul className="divide-y divide-sand/60">
                  <AnimatePresence initial={false}>
                    {items.map((i) => <CartLine key={i.key} item={i} line={lineFor(i)} compact issue={quote?.issues?.find((x) => x.productId === i.productId)?.message} />)}
                  </AnimatePresence>
                </ul>
              )}
            </div>
            {items.length > 0 && (
              <div className="border-t border-sand/70 p-5">
                <div className="mb-1 flex justify-between text-[15px]"><span className="text-muted">Subtotal</span><span className="font-bold tabular-nums">{formatINR(subtotal)}</span></div>
                <p className="mb-4 text-xs text-muted">Delivery, discounts and taxes are calculated at checkout.</p>
                <div className="grid gap-2">
                  <Button as={Link} to="/checkout" size="lg" onClick={close}>Checkout</Button>
                  <Button as={Link} to="/cart" variant="outline" onClick={close}>View full cart</Button>
                </div>
              </div>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
