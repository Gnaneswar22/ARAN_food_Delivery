import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Bike, CakeSlice, ChefHat, ChevronLeft, ChevronRight, Clock, Cookie, Crown, CupSoda, Drumstick, Heart, LayoutGrid, Leaf, Play, Salad, ShoppingBag, Sparkles, UtensilsCrossed } from 'lucide-react';
import { useFetch } from '../../hooks';
import { selectCartCount, setCartOpen } from '../../store';
import { ease } from '../../components/common';
import { Marquee } from '../../components/common/motion';
import { useAddToCart } from '../../components/products/ProductCard';
import { cx, formatINR } from '../../utils';

/** Design-pixel helper: 1 design px == 1px on a 1672px-wide screen, and scales smoothly with the viewport (see --u in index.css). */
const u = (n) => `calc(var(--u) * ${n})`;
/** Type & icon scale: ~8% smaller than the layout scale so text stays crisp and light. */
const f = (n) => u(+(n * 0.92).toFixed(1));

const ctaTo = (s) => (s.productId?.slug ? `/product/${s.productId.slug}` : `/menu?q=${encodeURIComponent(s.title)}`);

const TRUST_ITEMS = [
  [ChefHat, 'Freshly Made'],
  [Leaf, 'Quality Ingredients'],
  [Clock, 'Same Day Delivery'],
  [Heart, 'Loved by Foodies'],
];

/** Mobile quick categories. */
const QUICK_CATEGORIES = [
  { label: 'Desserts', slug: 'desserts', Icon: Sparkles, tint: 'bg-[#FDECE0] text-brand' },
  { label: 'Salads', slug: 'salads', Icon: Salad, tint: 'bg-[#E7F2E9] text-ok' },
  { label: 'Burgers', slug: 'burgers', Icon: UtensilsCrossed, tint: 'bg-[#FFF3DA] text-[#B86A14]' },
  { label: 'Pizzas', slug: 'pizzas', Icon: ChefHat, tint: 'bg-[#FCE5E3] text-[#C4423B]' },
  { label: 'Bowls', slug: 'bowls', Icon: Leaf, tint: 'bg-[#EDE6DF] text-[#4A1E0E]' },
  { label: 'All Menu', slug: '', Icon: LayoutGrid, tint: 'bg-sand/60 text-ink' },
];

/** Desktop category tabs (key = which slide kind highlights it). */
const DESKTOP_TABS = [
  { key: 'desserts', label: 'Desserts', Icon: CakeSlice, to: '/menu?category=desserts' },
  { key: 'salads', label: 'Salads', Icon: Salad, to: '/menu?category=salads' },
  { key: 'chips', label: 'Chips', Icon: Cookie, to: '/menu?q=chips' },
  { key: 'chicken', label: 'Chicken', Icon: Drumstick, to: '/menu?q=chicken' },
  { key: 'combos', label: 'Combos', Icon: CupSoda, to: '/menu?q=combo' },
  { key: 'all', label: 'All Menu', Icon: LayoutGrid, to: '/menu' },
];

/**
 * Built-in slides. The hero renders these on the very first paint (and if the API is empty / unreachable),
 * so the final design is on screen immediately instead of a skeleton/intro that later swaps to the real hero.
 */
const DEFAULT_SLIDES = [
  ['classic-tiramisu', 'Classic Tiramisu', 'Espresso-soaked layers under a dusting of cocoa.', 'Bestseller', 16900],
  ['biscoff-tiramisu', 'Biscoff Tiramisu', 'Creamy mascarpone layered with crunchy biscuit crumble.', 'New', 17900],
  ['veg-chips-salad', 'Veg Chips Salad', 'Crisp greens, corn, olives and spiced chips with creamy dressing.', 'Fresh', 14900],
  ['chicken-salad-chips-bowl', 'Chicken Salad Chips Bowl', 'Grilled chicken, crunchy chips and a herby dressing.', 'Hearty', 19900],
].map(([slug, title, subtitle, tag, pricePaise]) => ({
  _id: `default-${slug}`, title, subtitle, tag, ctaLabel: 'Order Now',
  image: { url: `/images/hero/${slug}.webp` },
  productId: { slug, name: title, pricePaise },
}));

const SLIDE_ORDER = DEFAULT_SLIDES.map((d) => d.productId.slug);
const rankOf = (s) => { const i = SLIDE_ORDER.indexOf(s.productId?.slug); return i === -1 ? SLIDE_ORDER.length : i; };
/** Live slides with the four signature dishes in the designed order (stable sort: any extra slides keep their admin order after them). */
const normalizeSlides = (data) => (data?.length ? [...data].sort((a, b) => rankOf(a) - rankOf(b)) : DEFAULT_SLIDES);

const slideKey = (s) => s.productId?.slug || s._id;
const kindOf = (s) => {
  const t = `${s.title}`.toLowerCase();
  if (/salad|bowl/.test(t)) return 'salads';
  if (/chips/.test(t)) return 'chips';
  if (/chicken/.test(t)) return 'chicken';
  if (/tiramisu|cake|dessert|brownie|pudding/.test(t)) return 'desserts';
  return 'all';
};
const signatureWord = (s) => ({ desserts: 'Dessert', salads: 'Salad' }[kindOf(s)] || s.tag || 'Dish');
const leadText = (s) => (s.subtitle || '').replace(/[.\s]+$/, '');
const titleCase = (t) => t.replace(/\b\w/g, (c) => c.toUpperCase());
/** Dark first line + orange italic last line ("Classic" / "Tiramisu"). */
function splitTitle(title) {
  const w = title.trim().split(/\s+/);
  if (w.length < 2) return [[], w];
  const k = w.length > 3 ? 2 : 1;
  return [w.slice(0, -k), w.slice(-k)];
}

function MarqueeStrip() {
  return (
    <div className="relative -rotate-[1deg] border-y-2 border-ink bg-brand py-3.5 text-white">
      <Marquee speed={28} items={['Freshly prepared', 'Quality ingredients', 'Carefully packed', 'Easy ordering', 'Delivered to your door'].map((t) => <><span className="font-heading text-[20px] font-extrabold uppercase tracking-tight">{t}</span><span className="text-lg">✦</span></>)} />
    </div>
  );
}

const imgVariants = {
  enter: (d) => ({ opacity: 0, x: d * 50, scale: 0.97 }),
  center: { opacity: 1, x: 0, scale: 1 },
  exit: (d) => ({ opacity: 0, x: -d * 50, scale: 1.02 }),
};

const mobileImgVariants = {
  enter: (d) => ({ opacity: 0, x: d * 40 }),
  center: { opacity: 1, x: 0 },
  exit: (d) => ({ opacity: 0, x: -d * 40 }),
};

/** Extra hero height in design px (0 = original size). Raise/lower to taste. */
const E = 0;
const BROWN = '#4A1E0E';
const INK = '#3E1A0B';

function HeroCarousel({ slides }) {
  const reduce = useReducedMotion();
  const dispatch = useDispatch();
  const cartCount = useSelector(selectCartCount);
  const addToCart = useAddToCart();
  const n = slides.length;
  const touchStartX = useRef(null);
  const [idx, setIdx] = useState(0);
  const prev = useRef(0);
  const [dir, setDir] = useState(1);

  const setIndex = useCallback((i) => { setDir(i >= prev.current ? 1 : -1); prev.current = i; setIdx(i); }, []);
  useEffect(() => { slides.forEach((x) => { const im = new Image(); im.src = x.image.url; }); }, [slides]);
  useEffect(() => { if (idx > n - 1) setIndex(0); }, [idx, n, setIndex]);

  const goTo = (i) => setIndex(((i % n) + n) % n);

  const s = slides[Math.min(idx, n - 1)];
  const linkedProduct = s.productId?.pricePaise != null ? s.productId : null;
  const canQuickAdd = Boolean(linkedProduct?._id && linkedProduct.isAvailable !== false);
  const cartItems = useSelector((st) => st.cart.items);
  const inCart = canQuickAdd && cartItems.some((i) => i.productId === linkedProduct._id);
  const goToCart = () => dispatch(setCartOpen(true));
  const lead = leadText(s);
  const [line1, line2] = splitTitle(s.title);
  const maxLen = Math.max(line1.join(' ').length, line2.join(' ').length);
  const titleSize = Math.min(100, Math.floor(1000 / Math.max(maxLen, 1)));
  const activeTab = kindOf(s);
  const ctaLabel = titleCase(s.ctaLabel || 'Order Now');

  const handleQuickAdd = () => {
    if (!canQuickAdd) return;
    addToCart({
      ...linkedProduct,
      images: linkedProduct.images?.length ? linkedProduct.images : [{ url: s.image?.url }],
    });
  };

  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchStartX.current == null || n < 2) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) > 40) goTo(dx < 0 ? idx + 1 : idx - 1);
  };

  return (
    <section className="relative overflow-x-clip bg-[#FBF6F0]">
      {/* ================= MOBILE HERO ================= */}
      <div className="container-x pb-8 pt-4 min-[1180px]:hidden">
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <AnimatePresence mode="wait" initial={false}>
              <motion.h1 key={slideKey(s)} aria-label={s.title} className="font-serif text-[38px] font-extrabold leading-[0.98] tracking-[-0.03em] text-[#3E1A0B]">
                {s.title.split(' ').map((w, i, words) => {
                  const isLast = i === words.length - 1 && words.length > 1;
                  return (
                    <span key={i} className={cx('mr-[0.2em] inline-block', isLast && 'italic font-semibold text-brand')}>
                      {w}
                    </span>
                  );
                })}
              </motion.h1>
            </AnimatePresence>
            <p className="mt-2 max-w-[235px] text-[13px] leading-snug text-[#6E5648]">
              {lead}, crafted fresh at <strong className="font-bold text-[#3E1A0B]">ARAN.CO</strong>.
            </p>
          </div>

          {/* Circular Signature Badge + curved arrow */}
          <div className="relative shrink-0 pt-1">
            <div className="grid size-[92px] place-items-center rounded-full border border-sand bg-[#FFFBF5] p-2 text-center shadow-sm">
              <div className="flex flex-col items-center">
                <Crown className="mb-0.5 size-4 text-brand" />
                <span className="font-serif text-[13px] italic font-semibold leading-tight text-[#4A1E0E]">
                  Signature<br />{signatureWord(s)}
                </span>
              </div>
            </div>
            <svg viewBox="0 0 36 32" className="mx-auto -mt-1 h-6 w-7 text-[#4A1E0E]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M22 2 C22 14, 14 22, 6 26" />
              <path d="M12 28 L5 27 L8 20" />
            </svg>
          </div>
        </div>

        {/* Full-width swipeable dish image */}
        <div
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          className="relative mt-2 aspect-[16/10] w-full touch-pan-y md:aspect-[21/9] overflow-hidden rounded-[24px] bg-white shadow-[0_18px_40px_-14px_rgba(40,35,31,0.25)]"
        >
          <AnimatePresence initial={false} custom={dir} mode="wait">
            <motion.div
              key={slideKey(s)}
              custom={dir}
              variants={mobileImgVariants}
              initial={reduce ? false : 'enter'}
              animate="center"
              exit={reduce ? undefined : 'exit'}
              transition={{ duration: 0.28, ease }}
              className="absolute inset-0 will-change-transform"
            >
              <img src={s.image.url} alt={s.title} width="1200" height="800" fetchPriority="high" decoding="async" className="size-full object-cover" />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Price + Freshly made badge + Pagination dots */}
        <div className="mt-3.5 flex items-center justify-between gap-2">
          <div>
            {linkedProduct?.pricePaise != null && (
              <p className="font-heading text-[28px] font-extrabold leading-none tabular-nums text-[#3E1A0B]">{formatINR(linkedProduct.pricePaise)}</p>
            )}
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-ok/25 bg-[#E7F2E9] px-2.5 py-0.5 text-[11px] font-bold text-ok">
              <Leaf className="size-3" />
              Freshly made to order
            </span>
          </div>
          {n > 1 && (
            <div className="flex items-center gap-1.5" role="group" aria-label="Hero slides">
              {slides.map((item, i) => (
                <button
                  key={slideKey(item)}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`Show ${item.title}`}
                  className={cx('h-2 rounded-full transition-all', i === idx ? 'w-5 bg-brand' : 'w-2 bg-ink/20')}
                />
              ))}
            </div>
          )}
        </div>

        {/* Side-by-side CTAs */}
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {canQuickAdd ? (
            <button type="button" onClick={inCart ? goToCart : handleQuickAdd} className={cx('inline-flex h-11 items-center justify-center gap-2 rounded-full px-4 text-[14px] font-bold text-white shadow-md transition-colors active:scale-95', inCart ? 'bg-[#4A1E0E]' : 'bg-brand')}>
              {inCart ? <ShoppingBag className="size-4" /> : <Bike className="size-4" />}
              <span>{inCart ? 'Go to Cart' : 'Order Now'}</span>
              <ChevronRight className="size-4" />
            </button>
          ) : (
            <Link to={ctaTo(s)} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-brand px-4 text-[14px] font-bold text-white shadow-md">
              <Bike className="size-4" />
              <span>Order Now</span>
              <ChevronRight className="size-4" />
            </Link>
          )}
          {cartCount > 0 && !inCart ? (
            <button type="button" onClick={() => dispatch(setCartOpen(true))} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#4A1E0E] px-4 text-[14px] font-bold text-white active:scale-95">
              <ShoppingBag className="size-4" />
              <span>Go to Cart ({cartCount})</span>
            </button>
          ) : (
            <Link to="/menu" className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-ink/25 bg-white px-4 text-[14px] font-bold text-[#3E1A0B] active:scale-95">
              <LayoutGrid className="size-4" />
              <span>View Menu</span>
            </Link>
          )}
        </div>

        {/* 4-Column Trust Strip */}
        <div className="mt-4 grid grid-cols-4 divide-x divide-sand/70 rounded-2xl border border-sand/80 bg-white/95 py-2.5 text-center shadow-sm">
          {TRUST_ITEMS.map(([Icon, label]) => (
            <div key={label} className="flex flex-col items-center justify-center gap-1 px-1">
              <Icon className="size-4 text-[#4A1E0E]" />
              <span className="text-[10px] font-semibold leading-tight text-[#3E1A0B]">{label}</span>
            </div>
          ))}
        </div>

        {/* Explore Our Menu Categories */}
        <div className="mt-5">
          <h2 className="font-serif text-[18px] font-extrabold text-[#3E1A0B]">Explore Our Menu</h2>
          <div className="no-scrollbar -mx-4 mt-2.5 flex gap-2.5 overflow-x-auto px-4 pb-1">
            {QUICK_CATEGORIES.map(({ label, slug, Icon, tint }) => (
              <Link key={label} to={slug ? `/menu?category=${slug}` : '/menu'} className="flex min-w-[78px] flex-col items-center gap-1.5 rounded-2xl border border-sand/80 bg-white p-2.5 text-center shadow-sm">
                <span className={cx('grid size-9 place-items-center rounded-xl', tint)}>
                  <Icon className="size-4" />
                </span>
                <span className="text-[11px] font-bold text-[#3E1A0B]">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ================= DESKTOP / LAPTOP HERO =================
          Laid out on a 1672px design canvas; every size is `u(px)` so it scales proportionally on laptops and large monitors.
          Pulled up under the (transparent) sticky header so the artwork starts at the very top, as in the design. */}
      <div className="relative hidden overflow-x-clip min-[1180px]:-mt-[92px] min-[1180px]:block" style={{ height: u(890 + E) }}>
        <div className="absolute left-1/2 top-0 -translate-x-1/2" style={{ width: u(1672), height: u(930 + E) }}>
          {/* ---- background art ---- */}
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            {/* soft white swoosh behind the logo */}
            <svg className="absolute left-0 top-0" style={{ width: u(1230), height: u(150) }} viewBox="0 0 1230 150" preserveAspectRatio="none">
              <path d="M0 0H1230C1190 38 1110 70 1000 82C880 96 760 100 640 118C520 136 380 140 250 128C130 118 40 90 0 60Z" fill="#fff" opacity="0.62" />
            </svg>
            {/* big brown organic shape */}
            <svg className="absolute right-0 top-0" style={{ width: u(1672), height: u(700 + E) }} viewBox="0 0 1672 700" preserveAspectRatio="none">
              <defs>
                <linearGradient id="hero-brown" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#6A3418" />
                  <stop offset="1" stopColor="#4B2210" />
                </linearGradient>
              </defs>
              <path d="M1672 0V690H1010C905 690 830 640 830 552C830 420 940 312 1072 206C1190 112 1330 98 1462 84C1562 72 1632 40 1672 0Z" fill="url(#hero-brown)" />
            </svg>
            <div className="absolute top-0" style={{ left: u(1671), width: '30vw', height: u((690 * (700 + E)) / 700), background: 'linear-gradient(180deg,#5A2A14 0%,#52250F 55%,#4B2210 100%)' }} />
            <div className="absolute right-full top-0 bg-white opacity-60" style={{ width: '30vw', height: u(60) }} />
          </div>

          {/* ---- left column: one evenly-spaced block, vertically centred in the hero area ---- */}
          <div className="absolute flex flex-col items-start justify-center" style={{ left: u(120), top: u(158), width: u(720), height: u(584 + E) }}>
            <span className="inline-flex shrink-0 items-center rounded-full bg-white/85 font-heading font-bold uppercase text-[#4A1E0E] shadow-[0_6px_18px_rgba(74,30,14,0.07)]" style={{ height: u(42), gap: u(10), paddingInline: u(20), fontSize: f(16), letterSpacing: '0.05em' }}>
              <Leaf className="text-ok" style={{ width: f(21), height: f(21) }} strokeWidth={1.8} />
              ARAN Signature Menu
            </span>

            <div style={{ marginTop: u(22), minHeight: f(titleSize * 1.96) }} aria-live="polite">
              <AnimatePresence mode="wait" initial={false}>
                <motion.h1
                  key={slideKey(s)}
                  aria-label={s.title}
                  initial={reduce ? false : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: -10 }}
                  transition={{ duration: 0.32, ease }}
                  className="font-serif font-extrabold"
                  style={{ fontSize: f(titleSize), lineHeight: 1.04, letterSpacing: '-0.025em', color: INK }}
                >
                  {line1.length > 0 && <span className="block">{line1.join(' ')}</span>}
                  <span className="relative block w-fit italic text-brand">
                    {line2.join(' ')}
                    <svg viewBox="0 0 40 50" className="absolute text-brand" style={{ right: '-0.5em', top: '0.1em', width: '0.5em', height: '0.6em' }} fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" aria-hidden>
                      <path d="M6 40 L18 14 M22 46 L32 22 M32 40 L42 30" transform="translate(-2 0)" />
                    </svg>
                  </span>
                </motion.h1>
              </AnimatePresence>
            </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={slideKey(s)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="flex shrink-0 flex-col items-start" style={{ marginTop: u(16), gap: u(20) }}>
                <p className="font-body font-normal text-[#5B4A40]" style={{ maxWidth: u(540), fontSize: f(22), lineHeight: 1.55, letterSpacing: '-0.005em' }}>
                  {lead}, crafted fresh at <strong className="font-extrabold text-[#3E1A0B]">ARAN.CO</strong>.
                </p>
                {linkedProduct?.pricePaise != null && (
                  <div className="flex items-center" style={{ gap: u(18) }}>
                    <span className="font-serif font-bold lining-nums tabular-nums" style={{ fontSize: f(48), lineHeight: 1, letterSpacing: '-0.02em', color: INK }}>{formatINR(linkedProduct.pricePaise)}</span>
                    <span className="bg-sand" style={{ width: 1, height: u(34) }} />
                    <span className="inline-flex items-center rounded-full bg-[#E6F2E4] font-bold font-heading text-[#2E7A33]" style={{ height: u(42), gap: u(10), paddingInline: u(18), fontSize: f(17.5) }}>
                      <Leaf style={{ width: f(20), height: f(20) }} strokeWidth={1.8} />
                      Freshly made to order
                    </span>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            <div className="flex shrink-0 items-center" style={{ marginTop: u(28), gap: u(18) }}>
              {canQuickAdd ? (
                <button type="button" onClick={inCart ? goToCart : handleQuickAdd} className={cx('inline-flex items-center justify-center whitespace-nowrap rounded-full font-heading font-bold text-white transition-colors', inCart ? 'bg-[#4A1E0E] shadow-[0_10px_24px_rgb(74_30_14/0.3)] hover:bg-[#5d2711]' : 'bg-gradient-to-b from-[#F5833F] to-[#E96A22] shadow-[0_10px_24px_rgb(232_117_53/0.34)] hover:brightness-95')} style={{ height: u(56), paddingInline: u(30), gap: u(10), fontSize: f(19.5) }}>
                  <ShoppingBag style={{ width: f(22), height: f(22) }} />
                  {inCart ? 'Go to Cart' : 'Add to Cart'}
                  {inCart && <ChevronRight style={{ width: f(18), height: f(18) }} />}
                </button>
              ) : (
                <Link to={ctaTo(s)} className="inline-flex items-center justify-center whitespace-nowrap rounded-full bg-gradient-to-b from-[#F5833F] to-[#E96A22] font-bold text-white shadow-[0_10px_24px_rgb(232_117_53/0.34)] transition hover:brightness-95" style={{ height: u(56), paddingInline: u(30), gap: u(10), fontSize: f(19.5) }}>
                  <ShoppingBag style={{ width: f(22), height: f(22) }} />
                  Add to Cart
                </Link>
              )}
              <Link to={ctaTo(s)} className="inline-flex items-center justify-center whitespace-nowrap rounded-full border-[1.5px] bg-white/50 font-heading font-bold transition-colors hover:bg-[#4A1E0E] hover:text-white" style={{ height: u(56), paddingInline: u(28), gap: u(10), fontSize: f(19.5), color: INK, borderColor: INK }}>
                <Bike style={{ width: f(24), height: f(24) }} strokeWidth={1.6} />
                {ctaLabel}
                <ChevronRight style={{ width: f(18), height: f(18) }} />
              </Link>
              <Link to="/our-story" className="inline-flex items-center whitespace-nowrap font-body font-medium transition-colors hover:text-brand" style={{ gap: u(12), fontSize: f(17.5), color: INK }}>
                <span className="grid place-items-center rounded-full bg-white shadow-sm ring-1 ring-sand" style={{ width: u(44), height: u(44) }}>
                  <Play className="fill-current" style={{ width: f(15), height: f(15) }} />
                </span>
                Watch How We Make It
              </Link>
            </div>

            <div className="flex shrink-0 items-center rounded-full bg-white/70 shadow-[0_6px_20px_-10px_rgba(74,30,14,0.15)]" style={{ marginTop: u(26), position: 'relative', top: u(8), height: u(70), paddingInline: u(10) }}>
              {TRUST_ITEMS.map(([Icon, label], i) => (
                <div key={label} className="flex items-center" style={{ gap: u(11), paddingInline: u(20), height: u(40), borderLeft: i ? '1px solid rgba(233,223,208,0.95)' : 'none' }}>
                  <Icon className="shrink-0" style={{ width: f(32), height: f(32), color: BROWN }} strokeWidth={1.5} />
                  <span className={cx('font-body font-medium', i === 0 && 'whitespace-nowrap')} style={{ fontSize: f(16.5), lineHeight: 1.22, color: INK, maxWidth: u(104) }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ---- right column ---- */}
          <div className="absolute text-center font-script font-bold" style={{ left: u(872), top: u(152), fontSize: f(40), lineHeight: 0.92, color: INK, transform: 'rotate(-9deg)', transformOrigin: 'left top' }} aria-hidden>
            Our<br />Signature<br />{signatureWord(s)}
          </div>
          <svg className="absolute" style={{ left: u(938), top: u(252), width: u(70), height: u(60), color: INK }} viewBox="0 0 70 60" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 4C8 26 26 40 56 46" />
            <path d="M44 36L58 46L42 54" />
          </svg>
          <svg className="absolute" style={{ left: u(1330), top: u(160), width: u(60), height: u(54), color: '#F39A3C' }} viewBox="0 0 60 54" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" aria-hidden>
            <path d="M6 14 L20 40 M26 8 L34 36 M44 22 L54 34" />
          </svg>

          {/* dish photo, masked into a plate-like organic shape */}
          <div className="absolute" style={{ right: u(27), top: u(156), width: u(744), height: u(524 + E), filter: 'drop-shadow(0 28px 34px rgba(28,10,2,0.45))' }}>
            <div className="relative size-full overflow-hidden bg-[#3a1a0c]" style={{ borderRadius: '58% 36% 40% 52% / 70% 40% 46% 38%' }}>
              <AnimatePresence initial={false} custom={dir} mode="wait">
                <motion.div
                  key={slideKey(s)}
                  custom={dir}
                  variants={imgVariants}
                  initial={reduce ? false : 'enter'}
                  animate="center"
                  exit={reduce ? undefined : 'exit'}
                  transition={{ duration: 0.45, ease }}
                  className="absolute inset-0 will-change-transform"
                >
                  <img src={s.image.url} alt={s.title} width="1200" height="960" fetchPriority="high" decoding="async" className="size-full object-cover" />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {n > 1 && (
            <>
              <div className="absolute z-10 flex items-center" style={{ left: u(1316), top: u(633 + E), gap: u(10) }} role="group" aria-label="Hero slides">
                {slides.map((item, i) => (
                  <button
                    key={slideKey(item)}
                    type="button"
                    onClick={() => goTo(i)}
                    aria-label={`Show ${item.title}`}
                    aria-current={i === idx}
                    className="rounded-full transition-colors"
                    style={{ width: u(15), height: u(15), background: i === idx ? '#F26B1D' : 'rgba(255,255,255,0.78)' }}
                  />
                ))}
              </div>
              <div className="absolute z-10 flex items-center" style={{ left: u(1440), top: u(620 + E), gap: u(11) }}>
                {[['Previous dish', ChevronLeft, -1], ['Next dish', ChevronRight, 1]].map(([label, Icon, d]) => (
                  <button key={label} type="button" onClick={() => goTo(idx + d)} aria-label={label} className="grid place-items-center rounded-full bg-white shadow-[0_6px_16px_rgba(0,0,0,0.2)] transition-transform hover:scale-105" style={{ width: u(42), height: u(42), color: INK }}>
                    <Icon style={{ width: f(22), height: f(22) }} strokeWidth={2.4} />
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ---- category quick links: one slim pill bar ---- */}
          <nav aria-label="Menu categories" className="absolute left-1/2 flex -translate-x-1/2 items-center rounded-full bg-white/85 shadow-[0_12px_34px_-14px_rgba(74,30,14,0.22)] backdrop-blur-sm" style={{ top: u(776 + E), padding: u(9), gap: u(6) }}>
            {DESKTOP_TABS.map(({ key, label, Icon, to }) => {
              const active = key === activeTab;
              return (
                <Link key={key} to={to} aria-current={active ? 'true' : undefined} className={cx('inline-flex items-center whitespace-nowrap rounded-full font-semibold transition-colors', active ? 'bg-[#FCE6D6] text-[#4A1E0E]' : 'text-[#5B4A40] hover:bg-[#FCE6D6]/60 hover:text-[#4A1E0E]')} style={{ height: u(54), paddingInline: u(24), gap: u(10), fontSize: f(17) }}>
                  <Icon style={{ width: f(26), height: f(26), color: active ? '#E8742F' : '#A8613A' }} strokeWidth={1.5} />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <MarqueeStrip />
    </section>
  );
}

export default function Hero() {
  // Never show a skeleton / alternate hero: built-in slides render instantly, live slides replace them silently.
  const { data } = useFetch('/hero-slides');
  const slides = useMemo(() => normalizeSlides(data), [data]);
  return <HeroCarousel slides={slides} />;
}
