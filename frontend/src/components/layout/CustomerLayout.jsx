import { Suspense, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { Menu, Search, ShoppingBag, User, X, Mail, Phone, MapPin, Home as HomeIcon, UtensilsCrossed, Leaf, Tag, Bell, Clock } from 'lucide-react';
import { cx, formatINR } from '../../utils';
import { useScrolled } from '../../hooks';
import { selectCartCount, setCartOpen, setMenuOpen } from '../../store';
import { PageLoader, ErrorBoundary, ease } from '../common';
import { ScrollProgress } from '../common/motion';
import CartDrawer from '../cart/CartDrawer';
import PwaPrompts from './PwaPrompts';
import { useContact } from '../../config/siteContent';

const Instagram = (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" /></svg>;
const Facebook = (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>;

/** Brand wordmark. Name comes from admin settings (default "ARAN.co"); a ".co"-style suffix is set in the accent colour. */
export function BrandName({ name }) {
  const [base, ...rest] = (name || 'ARAN.co').split('.');
  return <>{base.toUpperCase()}{rest.length > 0 && <span className="text-brand lowercase tracking-normal">.{rest.join('.')}</span>}</>;
}
export const Logo = ({ className, light }) => {
  const brand = useSelector((s) => s.settings.data?.brand);
  const name = brand?.name || 'ARAN.co';
  const logoSrc = brand?.logo || '/images/aran-logo.png';
  return (
    <Link to="/" aria-label={`${name} home`} className={cx('inline-flex shrink-0 items-center gap-2', light && 'rounded-2xl bg-cream px-4 py-2', className)}>
      <img src={logoSrc} alt={name} className="h-[68px] w-auto object-contain mix-blend-multiply sm:h-[72px] lg:h-[calc(var(--u)*88)]" />
    </Link>
  );
};
const NAV = [
  ['/', 'Home', HomeIcon],
  ['/menu', 'Menu', UtensilsCrossed],
  ['/our-story', 'Our Story', Leaf],
  ['/offers', 'Offers', Tag],
  ['/contact', 'Contact', Phone],
];

function CartButton({ className }) {
  const count = useSelector(selectCartCount);
  const dispatch = useDispatch();
  return (
    <button onClick={() => dispatch(setCartOpen(true))} className={cx('relative inline-flex h-11 items-center justify-center rounded-full bg-brand px-4 text-white shadow-[0_8px_20px_-6px_rgb(232_117_53/0.6)] ring-2 ring-white/70 transition-colors hover:bg-brand-dark lg:h-[calc(var(--u)*52)] lg:w-[calc(var(--u)*82)]', className)} aria-label={`Open cart, ${count} items`}>
      <ShoppingBag className="size-5 lg:size-[22px]" />
      <AnimatePresence initial={false}>
        {count > 0 && (
          <motion.span key={count} initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }} className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-[#4A1E0E] px-1.5 text-[11px] font-bold leading-5 text-white ring-2 ring-white">{count}</motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

function SearchBox({ onDone, autoFocus }) {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  return (
    <form role="search" onSubmit={(e) => { e.preventDefault(); if (q.trim()) { nav(`/menu?q=${encodeURIComponent(q.trim())}`); onDone?.(); } }} className="relative">
      <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
      <input autoFocus={autoFocus} value={q} onChange={(e) => setQ(e.target.value)} className="field pl-10" placeholder="Search dishes…" aria-label="Search dishes" />
    </form>
  );
}

function Header() {
  const scrolled = useScrolled(24);
  const dispatch = useDispatch();
  const { pathname } = useLocation();
  const user = useSelector((s) => s.auth.user);
  const settings = useSelector((s) => s.settings.data);
  const [search, setSearch] = useState(false);
  const closed = settings && !settings.status?.open;
  return (
    <>
      {closed && <div className="bg-ink px-4 py-2 text-center text-[13px] text-white" role="status">{settings.status.reason} You can still browse the menu.</div>}
      <header className="sticky top-0 z-40 bg-[#FAF5EE]/95 px-3 pt-2 backdrop-blur-md sm:px-6 lg:bg-transparent lg:px-0 lg:pt-3 lg:backdrop-blur-none">
        <div className={cx('mx-auto flex h-[76px] items-center justify-between gap-2 rounded-full px-1 sm:px-2 transition-[max-width,background-color,box-shadow,backdrop-filter] duration-300 ease-out sm:px-6 lg:h-20', scrolled ? 'max-w-[1120px] lg:bg-white/90 lg:shadow-[0_8px_30px_rgb(40_35_31/0.1)] lg:ring-1 lg:ring-sand/70 lg:backdrop-blur-md' : 'max-w-[1280px] bg-transparent lg:max-w-[calc(var(--u)*1672)] lg:px-[calc(var(--u)*120)] max-[1179px]:lg:max-w-[1040px] max-[1179px]:lg:px-0')}>
          <button onClick={() => dispatch(setMenuOpen(true))} className="grid size-11 place-items-center rounded-full hover:bg-sand/60 lg:hidden" aria-label="Open menu"><Menu className="size-6" /></button>
          <Logo className="lg:mr-2 lg:-ml-[calc(var(--u)*18)] max-[1179px]:lg:ml-0" />
          <nav className="relative hidden items-center gap-1 rounded-full bg-white/95 p-1.5 shadow-[0_8px_28px_rgb(40_35_31/0.07)] ring-1 ring-sand/70 lg:flex" aria-label="Main">
            {NAV.map(([to, label, Icon]) => {
              const active = to === '/' ? pathname === '/' : pathname.startsWith(to);
              return (
                <NavLink key={to} to={to} end={to === '/'} className={cx('relative inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-[14px] font-semibold transition-colors lg:gap-[calc(var(--u)*10)] lg:px-[calc(var(--u)*22)] lg:py-[calc(var(--u)*13)] lg:text-[calc(var(--u)*17)]', active ? 'text-white' : 'text-ink hover:text-brand')}>
                  {active && <motion.span layoutId="nav-pill" className="absolute inset-0 -z-0 rounded-full bg-[#4A1E0E]" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                  <Icon className="relative z-10 size-4 lg:size-[calc(var(--u)*20)]" />
                  <span className="relative z-10">{label}</span>
                </NavLink>
              );
            })}
          </nav>
          <div className="flex items-center gap-1">
            <button onClick={() => setSearch((v) => !v)} className="grid size-10 place-items-center rounded-full transition-colors hover:bg-sand/60 sm:size-11" aria-label="Search" aria-expanded={search}><Search className="size-[21px] lg:size-[20px]" /></button>
            <Link to={user ? '/account' : '/login'} className="relative hidden size-11 place-items-center rounded-full transition-colors hover:bg-sand/60 lg:grid" aria-label="Notifications"><Bell className="size-[21px] lg:size-[20px]" /><span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-brand ring-2 ring-[#FBF6F0]" aria-hidden /></Link>
            <Link to={user ? (user.role === 'customer' ? '/account' : '/admin') : '/login'} className="hidden size-11 place-items-center rounded-full transition-colors hover:bg-sand/60 sm:grid" aria-label="Account"><User className="size-[21px] lg:size-[20px]" /></Link>
            <CartButton />
          </div>
        </div>
        <AnimatePresence>
          {search && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease }} className="mx-auto mt-2 max-w-3xl overflow-hidden rounded-3xl bg-white shadow-lift ring-1 ring-sand/70">
              <div className="p-3"><SearchBox autoFocus onDone={() => setSearch(false)} /></div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    </>
  );
}

function MobileDrawer() {
  const open = useSelector((s) => s.ui.menuOpen);
  const user = useSelector((s) => s.auth.user);
  const dispatch = useDispatch();
  const close = () => dispatch(setMenuOpen(false));
  const loc = useLocation();
  useEffect(() => { dispatch(setMenuOpen(false)); }, [loc.pathname, dispatch]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-ink/45" onClick={close} aria-hidden />
          <motion.aside role="dialog" aria-modal="true" aria-label="Navigation" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ duration: 0.3, ease }} className="absolute right-0 top-0 flex h-full w-[84%] max-w-sm flex-col bg-cream p-5">
            <div className="flex items-center justify-between"><Logo /><button onClick={close} className="grid size-11 place-items-center rounded-full hover:bg-sand/60" aria-label="Close menu"><X className="size-6" /></button></div>
            <div className="mt-4"><SearchBox onDone={close} /></div>
            <nav className="mt-4 flex flex-col" aria-label="Mobile">
              {NAV.map(([to, label]) => (
                <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => cx('flex min-h-14 items-center border-b border-sand/70 text-lg font-semibold', isActive ? 'text-brand' : 'text-ink')}>{label}</NavLink>
              ))}
              <NavLink to={user ? (user.role === 'customer' ? '/account' : '/admin') : '/login'} className="flex min-h-14 items-center text-lg font-semibold">{user ? 'My account' : 'Sign in / Register'}</NavLink>
            </nav>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MobileBottomNav() {
  const user = useSelector((s) => s.auth.user);
  const { pathname } = useLocation();
  const profileTo = user ? (user.role === 'customer' ? '/account' : '/admin') : '/login';
  const tabs = [
    ['/', 'Home', HomeIcon],
    ['/menu', 'Menu', UtensilsCrossed],
    ['/offers', 'Offers', Tag],
    [profileTo, 'Profile', User],
  ];
  return (
    <nav aria-label="Mobile bottom navigation" className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t border-sand/80 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
      {tabs.map(([to, label, Icon]) => {
        const active = to === '/' ? pathname === '/' : pathname.startsWith(to);
        return (
          <Link key={label} to={to} className={cx('flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] font-bold transition-colors', active ? 'text-brand' : 'text-[#5A463A]')}>
            <Icon className="size-5" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function StickyCartBar() {
  const items = useSelector((s) => s.cart.items);
  const dispatch = useDispatch();
  const { pathname } = useLocation();
  const count = items.reduce((a, i) => a + i.quantity, 0);
  const total = items.reduce((a, i) => a + (i.unitPricePaise || 0) * i.quantity, 0);
  const hide = ['/cart', '/checkout'].some((p) => pathname.startsWith(p));
  return (
    <AnimatePresence>
      {count > 0 && !hide && (
        <motion.button initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }} transition={{ duration: 0.3, ease }} onClick={() => dispatch(setCartOpen(true))}
          className="fixed inset-x-3 bottom-[4.5rem] z-30 flex h-12 items-center justify-between rounded-2xl bg-brand px-5 text-sm font-semibold text-white shadow-lift lg:hidden">
          <span>{count} item{count > 1 ? 's' : ''} · {formatINR(total)}</span><span className="flex items-center gap-2">View cart <ShoppingBag className="size-4" /></span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

export function Footer() {
  const s = useSelector((st) => st.settings.data);
  const contact = useContact();
  const b = s?.brand || {};
  const col = (title, links) => <div><h4 className="mb-4 text-[12px] font-bold uppercase tracking-[0.2em] text-white/50">{title}</h4><ul className="space-y-2.5 text-[15px]">{links.map(([t, l]) => <li key={l}><Link className="group inline-flex items-center gap-1 text-white/85 transition-colors hover:text-brand" to={t}>{l}<span className="translate-x-[-4px] opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100">↗</span></Link></li>)}</ul></div>;
  return (
    <footer className="relative mt-16 overflow-hidden rounded-t-[32px] bg-ink text-white/80">
      <div className="container-x pt-12">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div>
            <Logo light className="mb-5" />
            <p className="max-w-xs font-serif text-[21px] italic leading-snug text-white">Good food, great moments — freshly made and brought to you.</p>
            <div className="mt-6 flex gap-3">{[[b.social?.instagram, 'Instagram', Instagram], [b.social?.facebook, 'Facebook', Facebook]].filter(([u]) => u).map(([u, l, I]) => <a key={l} href={u} target="_blank" rel="noreferrer" aria-label={l} className="grid size-11 place-items-center rounded-full bg-white/10 transition-all hover:-translate-y-1 hover:bg-brand"><I className="size-5" /></a>)}</div></div>
          {col('Menu', [['/menu', 'Full menu'], ['/menu?featured=true', 'Featured'], ['/menu?bestseller=true', 'Best sellers'], ['/offers', 'Offers']])}
          {col('Support', [['/account/orders', 'Track your order'], ['/contact', 'Contact us'], ['/contact#faq', 'Help & FAQs'], ['/terms', 'Terms'], ['/privacy', 'Privacy'], ['/refund-policy', 'Refunds']])}
          <div><h4 className="mb-4 text-[12px] font-bold uppercase tracking-[0.2em] text-white/50">Contact & Support</h4>
            <ul className="space-y-3 text-[15px]">
              <li className="flex gap-2.5"><MapPin className="mt-0.5 size-4 shrink-0 text-brand" /><span>{contact.address}</span></li>
              <li><a href={`tel:${contact.phone.replace(/[^+\d]/g, '')}`} className="flex gap-2.5 transition-colors hover:text-brand"><Phone className="mt-0.5 size-4 shrink-0 text-brand" /><span>{contact.phone}</span></a></li>
              <li><a href={`mailto:${contact.email}`} className="flex gap-2.5 transition-colors hover:text-brand"><Mail className="mt-0.5 size-4 shrink-0 text-brand" /><span>{contact.email}</span></a></li>
              <li className="flex gap-2.5"><Clock className="mt-0.5 size-4 shrink-0 text-brand" /><span>{contact.hours}</span></li>
            </ul></div>
        </div>
      </div>
      <motion.p initial={{ y: '40%', opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 1, ease }} className="pointer-events-none mt-10 select-none text-center font-heading text-[clamp(70px,18vw,230px)] font-extrabold leading-[0.8] tracking-[-0.06em] text-white/[0.07]" aria-hidden>{(b.name || 'ARAN.co').toUpperCase()}</motion.p>
      <div className="container-x relative -mt-4 border-t border-white/10 py-5 text-center text-[13px] text-white/50">© {new Date().getFullYear()} ARAN. All rights reserved.</div>
    </footer>
  );
}

export default function CustomerLayout() {
  const { pathname } = useLocation();
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) { const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }), 150); return () => clearTimeout(t); }
    window.scrollTo({ top: 0 });
  }, [pathname, hash]);
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">Skip to content</a>
      <ScrollProgress />
      <Header />
      <main id="main" className="flex-1">
        <ErrorBoundary key={pathname}>
          <Suspense fallback={<PageLoader />}>
            <motion.div key={pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease }}><Outlet /></motion.div>
          </Suspense>
        </ErrorBoundary>
      </main>
      <Footer />
      <MobileDrawer />
      <CartDrawer />
      <StickyCartBar />
      <MobileBottomNav />
      <PwaPrompts />
    </div>
  );
}
