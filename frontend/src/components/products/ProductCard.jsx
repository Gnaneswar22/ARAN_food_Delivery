import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { Heart, Plus, Check, ShoppingBag } from 'lucide-react';
import { addItem, setCartOpen, toast } from '../../store';
import { post, del, errMsg } from '../../services/api';
import { Badge, FoodDot, ProductImage } from '../common';
import { formatINR } from '../../utils';

export function useAddToCart() {
  const dispatch = useDispatch();
  return (p, { quantity = 1, options = [], note } = {}) => {
    dispatch(addItem({ productId: p._id, slug: p.slug, name: p.name, image: p.images?.[0]?.url, foodType: p.foodType, unitPricePaise: p.pricePaise + options.reduce((a, o) => a + (o.pricePaise || 0), 0), quantity, options, note }));
    dispatch(toast(`${p.name} added to cart`));
  };
}

export function WishlistButton({ productId, className = '' }) {
  const user = useSelector((s) => s.auth.user);
  const dispatch = useDispatch();
  const nav = useNavigate();
  const [on, setOn] = useState(false);
  const toggle = async (e) => {
    e.preventDefault(); e.stopPropagation();
    if (!user) return nav('/login', { state: { from: location.pathname } });
    try { on ? await del(`/account/wishlist/${productId}`) : await post(`/account/wishlist/${productId}`); setOn(!on); dispatch(toast(on ? 'Removed from wishlist' : 'Saved to wishlist')); }
    catch (err) { dispatch(toast(errMsg(err), 'error')); }
  };
  return (
    <button onClick={toggle} aria-pressed={on} aria-label={on ? 'Remove from wishlist' : 'Add to wishlist'} className={`grid size-9 place-items-center rounded-full bg-white/90 shadow-sm transition-colors hover:bg-white ${className}`}>
      <Heart className={`size-[18px] ${on ? 'fill-bad text-bad' : 'text-ink'}`} />
    </button>
  );
}

export default function ProductCard({ product: p }) {
  const dispatch = useDispatch();
  const add = useAddToCart();
  const reduce = useReducedMotion();
  const [done, setDone] = useState(false);
  const customizable = p.customizations?.length > 0;
  const unavailable = !p.available;
  const onAdd = (e) => { e.preventDefault(); add(p); setDone(true); setTimeout(() => setDone(false), 3000); };
  return (
    <motion.article whileHover={reduce ? undefined : { y: -8 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }} className="group relative flex h-full flex-col rounded-[22px] bg-white p-2.5 shadow-card ring-1 ring-sand/60 transition-shadow duration-300 hover:shadow-[0_24px_50px_rgb(40_35_31/0.14)] sm:rounded-[28px] sm:p-3">
      <Link to={`/product/${p.slug}`} className="relative block overflow-hidden rounded-[18px] sm:rounded-[22px]" aria-label={p.name}>
        <ProductImage src={p.images?.[0]?.url} alt={p.name} className="aspect-square w-full" />
        <div className="absolute left-2 top-2 flex flex-wrap gap-1 sm:left-3 sm:top-3 sm:gap-1.5">
          {p.isBestseller && <Badge tone="dark">Bestseller</Badge>}
          {p.isFeatured && !p.isBestseller && <Badge tone="orange">Featured</Badge>}
        </div>
        <WishlistButton productId={p._id} className="absolute right-2 top-2 sm:right-3 sm:top-3" />
        <span className="absolute bottom-2 left-2 hidden rounded-full bg-white/95 px-3.5 py-1.5 font-heading text-[15px] font-extrabold tabular-nums shadow-md backdrop-blur sm:inline-block">{formatINR(p.pricePaise)}{p.compareAtPricePaise > p.pricePaise && <s className="ml-1.5 text-xs font-medium text-muted">{formatINR(p.compareAtPricePaise)}</s>}</span>
        {unavailable && <div className="absolute inset-0 grid place-items-center bg-white/70 backdrop-blur-[2px]"><Badge tone="red" className="text-[13px]">{p.inStock ? 'Currently unavailable' : 'Sold out'}</Badge></div>}
      </Link>
      <div className="flex flex-1 flex-col px-1 pb-1 pt-2.5 sm:px-2 sm:pt-4">
        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-muted sm:mb-1.5 sm:gap-2 sm:text-xs"><FoodDot type={p.foodType} /><span className="truncate">{p.categoryId?.name}</span>{!unavailable && <span className="ml-auto hidden items-center gap-1 text-ok sm:flex"><span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-ok/60" /><span className="relative inline-flex size-2 rounded-full bg-ok" /></span>Available</span>}</div>
        <Link to={`/product/${p.slug}`}><h3 className="line-clamp-1 font-heading text-[15px] font-extrabold leading-tight tracking-tight transition-colors group-hover:text-brand sm:text-[17px]">{p.name}</h3></Link>
        <p className="mt-1 hidden line-clamp-2 text-[13px] leading-relaxed text-muted sm:block">{p.description}</p>
        <div className="mt-auto pt-2.5 sm:pt-4">
          <div className="flex items-center justify-between gap-2 sm:hidden">
            <span className="font-heading text-[16px] font-extrabold tabular-nums text-[#3E1A0B]">{formatINR(p.pricePaise)}</span>
            {customizable ? (
              <Link to={`/product/${p.slug}`} className="inline-flex h-8 items-center rounded-full bg-ink px-3 text-xs font-bold text-white">Options</Link>
            ) : done ? (
              <button type="button" onClick={(e) => { e.preventDefault(); dispatch(setCartOpen(true)); }} className="inline-flex h-8 items-center gap-1 rounded-full bg-ink px-3 text-xs font-bold text-white"><ShoppingBag className="size-3.5" />Cart</button>
            ) : (
              <button type="button" onClick={onAdd} disabled={unavailable} className="inline-flex h-8 items-center gap-1 rounded-full bg-brand px-3.5 text-xs font-bold text-white disabled:bg-sand disabled:text-muted"><Plus className="size-3.5" />Add</button>
            )}
          </div>
          <div className="hidden sm:block">
          {customizable ? (
            <Link to={`/product/${p.slug}`} className="flex h-12 items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-bold text-white transition-colors hover:bg-brand">Customise<span aria-hidden>?</span></Link>
          ) : done ? (
            <div className="flex gap-2">
              <motion.button whileTap={{ scale: 0.96 }} onClick={onAdd} className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-full bg-ok px-3 text-[14px] font-bold text-white" aria-label={`Add ${p.name} to cart again`}>
                <Check className="size-4" />Added
              </motion.button>
              <motion.button whileTap={{ scale: 0.96 }} onClick={(e) => { e.preventDefault(); dispatch(setCartOpen(true)); }} className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-full bg-ink px-3 text-[14px] font-bold text-white transition-colors hover:bg-brand">
                <ShoppingBag className="size-4" />Go to cart
              </motion.button>
            </div>
          ) : (
            <motion.button whileTap={{ scale: 0.96 }} onClick={onAdd} disabled={unavailable} className="relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-ink text-[15px] font-bold text-white transition-colors hover:bg-brand disabled:cursor-not-allowed disabled:bg-sand disabled:text-muted" aria-label={`Add ${p.name} to cart`}>
              <Plus className="size-5" />Add to cart
            </motion.button>
          )}
          </div>
        </div>
      </div>
    </motion.article>
  );
}
export const ProductCardSkeleton = () => (
  <div className="rounded-[28px] bg-white p-3 ring-1 ring-sand/60"><div className="skeleton aspect-square rounded-[22px]" /><div className="space-y-3 p-4"><div className="skeleton h-3 w-1/3" /><div className="skeleton h-5 w-3/4" /><div className="skeleton h-3 w-full" /><div className="skeleton h-10 w-full" /></div></div>
);
