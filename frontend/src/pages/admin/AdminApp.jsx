import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { Bell, Boxes, ChevronsLeft, ChevronsRight, FolderTree, LayoutDashboard, LogOut, Menu as MenuIcon, Package, Settings, ShoppingBag, Store, Tag, Truck, Users, BarChart3, Images, Volume2, VolumeX, X, UtensilsCrossed } from 'lucide-react';
import { get, post } from '../../services/api';
import { getSocket, resetSocket } from '../../services/socket';
import { logoutThunk, toast } from '../../store';
import { ErrorBoundary, PageLoader } from '../../components/common';
import { BrandName } from '../../components/layout/CustomerLayout';
import { cx, fmtDate } from '../../utils';

const page = (name) => lazy(() => import(`./pages/${name}.jsx`));
const Dashboard = page('Dashboard'), Orders = page('Orders'), Products = page('Products'), Categories = page('Categories'), Inventory = page('Inventory'),
  HeroSlides = page('HeroSlides'), Customers = page('Customers'), Delivery = page('Delivery'), Pickup = page('Pickup'), Coupons = page('Coupons'), Reports = page('Reports'), SettingsPage = page('SettingsPage');

const NAV = [
  ['/admin', 'Dashboard', LayoutDashboard, 'staff', true], ['/admin/orders', 'Orders', ShoppingBag, 'staff'], ['/admin/products', 'Products', Package, 'staff'], ['/admin/categories', 'Categories', FolderTree, 'staff'], ['/admin/hero', 'Homepage hero', Images, 'manager'],
  ['/admin/inventory', 'Inventory', Boxes, 'staff'], ['/admin/customers', 'Customers', Users, 'manager'], ['/admin/delivery', 'Delivery', Truck, 'staff'], ['/admin/pickup', 'Pickup', Store, 'staff'],
  ['/admin/coupons', 'Coupons', Tag, 'manager'], ['/admin/reports', 'Reports', BarChart3, 'manager'], ['/admin/settings', 'Settings', Settings, 'manager'],
];
const RANK = { staff: 1, manager: 2, owner: 3 };

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [880, 1175].forEach((f, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; o.connect(g); g.connect(ctx.destination); g.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.18); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.16); o.start(ctx.currentTime + i * 0.18); o.stop(ctx.currentTime + i * 0.18 + 0.17); });
  } catch { /* audio blocked until user gesture */ }
}

function NotificationBell({ soundOn }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const dispatch = useDispatch();
  const load = () => get('/account/notifications', { limit: 15 }).then((r) => { setItems(r.data); setUnread(r.meta?.unread || 0); }).catch(() => {});
  useEffect(() => {
    load();
    const s = getSocket();
    const onNew = (n) => { setItems((p) => [n, ...p].slice(0, 15)); setUnread((u) => u + 1); dispatch(toast(`${n.title}: ${n.body}`, n.type?.includes('failed') ? 'error' : 'info')); if (soundOn && n.type === 'order.new') beep(); };
    s.on('notification', onNew);
    return () => s.off('notification', onNew);
  }, [soundOn]); // eslint-disable-line
  return (
    <div className="relative">
      <button onClick={() => { setOpen((o) => !o); if (!open && unread) post('/account/notifications/read').then(() => setUnread(0)); }} className="relative grid size-10 place-items-center rounded-full hover:bg-sand/60" aria-label={`Notifications, ${unread} unread`} aria-expanded={open}><Bell className="size-5" />{unread > 0 && <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">{unread}</span>}</button>
      <AnimatePresence>{open && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="absolute right-0 top-12 z-50 w-80 max-w-[90vw] overflow-hidden rounded-xl border border-sand bg-white shadow-lift">
          <div className="border-b border-sand px-4 py-2.5 text-sm font-bold">Notifications</div>
          <ul className="max-h-80 divide-y divide-sand/60 overflow-y-auto">{items.length ? items.map((n) => <li key={n._id} className="px-4 py-3 text-sm"><p className="font-semibold">{n.title}</p><p className="text-muted">{n.body}</p><p className="mt-0.5 text-[11px] text-muted">{fmtDate(n.createdAt)}</p></li>) : <li className="px-4 py-6 text-center text-sm text-muted">No notifications yet</li>}</ul>
        </motion.div>)}</AnimatePresence>
    </div>
  );
}

function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen, role }) {
  const brand = useSelector((s) => s.settings.data?.brand?.name);
  const body = (narrow) => (
    <>
      <div className={cx('flex h-16 items-center border-b border-white/10 px-4', narrow ? 'justify-center' : 'justify-between')}>
        <Link to="/admin" className="flex items-center gap-2 font-heading text-xl font-extrabold tracking-wider text-white"><UtensilsCrossed className="size-5 text-brand" />{!narrow && <BrandName name={brand} />}</Link>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Admin">
        {NAV.filter(([, , , min]) => RANK[role] >= RANK[min]).map(([to, label, Icon, , end]) => (
          <NavLink key={to} to={to} end={end} title={label} onClick={() => setMobileOpen(false)} className={({ isActive }) => cx('flex h-11 items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition-colors', isActive ? 'bg-brand text-white' : 'text-white/70 hover:bg-white/10 hover:text-white', narrow && 'justify-center px-0')}><Icon className="size-5 shrink-0" />{!narrow && label}</NavLink>
        ))}
      </nav>
      <Link to="/" target="_blank" className={cx('m-3 flex h-10 items-center gap-2 rounded-xl text-sm text-white/60 hover:text-white', narrow ? 'justify-center' : 'px-3')}><Store className="size-4" />{!narrow && 'View storefront'}</Link>
    </>
  );
  return (
    <>
      <motion.aside animate={{ width: collapsed ? 76 : 240 }} transition={{ duration: 0.2 }} className="sticky top-0 hidden h-dvh shrink-0 flex-col bg-ink lg:flex">{body(collapsed)}</motion.aside>
      <AnimatePresence>{mobileOpen && (
        <motion.div className="fixed inset-0 z-50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-ink/50" onClick={() => setMobileOpen(false)} />
          <motion.aside initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }} transition={{ duration: 0.25 }} className="absolute left-0 top-0 flex h-full w-64 flex-col bg-ink">{body(false)}<button onClick={() => setMobileOpen(false)} className="absolute right-2 top-3 grid size-9 place-items-center text-white" aria-label="Close"><X className="size-5" /></button></motion.aside>
        </motion.div>)}</AnimatePresence>
    </>
  );
}

export default function AdminApp() {
  const user = useSelector((s) => s.auth.user);
  const dispatch = useDispatch();
  const nav = useNavigate();
  const loc = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem('aran_sound') !== '0');
  const crumb = NAV.find(([to, , , , end]) => (end ? loc.pathname === to : loc.pathname.startsWith(to)));
  const prevRole = useRef();
  useEffect(() => { prevRole.current = user?.role; }, [user]);

  if (!user || user.role === 'customer') return <Navigate to="/admin/login" replace />;
  const logout = async () => { await dispatch(logoutThunk()); resetSocket(); nav('/admin/login'); };
  return (
    <div className="flex min-h-dvh bg-cream">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} role={user.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-sand bg-white/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2">
            <button onClick={() => setMobileOpen(true)} className="grid size-10 place-items-center rounded-full hover:bg-sand/60 lg:hidden" aria-label="Open navigation"><MenuIcon className="size-5" /></button>
            <button onClick={() => setCollapsed((c) => !c)} className="hidden size-10 place-items-center rounded-full hover:bg-sand/60 lg:grid" aria-label="Toggle sidebar">{collapsed ? <ChevronsRight className="size-5" /> : <ChevronsLeft className="size-5" />}</button>
            <nav aria-label="Breadcrumb" className="text-sm text-muted"><span>Admin</span>{crumb && crumb[0] !== '/admin' && <> <span className="mx-1">/</span> <span className="font-semibold text-ink">{crumb[1]}</span></>}</nav>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => { const n = !soundOn; setSoundOn(n); localStorage.setItem('aran_sound', n ? '1' : '0'); if (n) beep(); }} className="grid size-10 place-items-center rounded-full hover:bg-sand/60" aria-label={soundOn ? 'Mute new-order sound' : 'Enable new-order sound'} aria-pressed={soundOn}>{soundOn ? <Volume2 className="size-5" /> : <VolumeX className="size-5 text-muted" />}</button>
            <NotificationBell soundOn={soundOn} />
            <div className="ml-2 hidden text-right sm:block"><p className="text-sm font-semibold leading-tight">{user.name}</p><p className="text-[11px] capitalize text-muted">{user.role}</p></div>
            <button onClick={logout} className="grid size-10 place-items-center rounded-full hover:bg-sand/60" aria-label="Sign out"><LogOut className="size-5" /></button>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">
          <ErrorBoundary key={loc.pathname}>
            <Suspense fallback={<PageLoader />}>
              <motion.div key={loc.pathname} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
                <Routes>
                  <Route index element={<Dashboard />} />
                  <Route path="orders" element={<Orders />} />
                  <Route path="products" element={<Products />} />
                  <Route path="categories" element={<Categories />} />
                  <Route path="hero" element={RANK[user.role] >= 2 ? <HeroSlides /> : <Navigate to="/admin" replace />} />
                  <Route path="inventory" element={<Inventory />} />
                  <Route path="customers" element={RANK[user.role] >= 2 ? <Customers /> : <Navigate to="/admin" replace />} />
                  <Route path="delivery" element={<Delivery />} />
                  <Route path="pickup" element={<Pickup />} />
                  <Route path="coupons" element={RANK[user.role] >= 2 ? <Coupons /> : <Navigate to="/admin" replace />} />
                  <Route path="reports" element={RANK[user.role] >= 2 ? <Reports /> : <Navigate to="/admin" replace />} />
                  <Route path="settings" element={RANK[user.role] >= 2 ? <SettingsPage /> : <Navigate to="/admin" replace />} />
                  <Route path="*" element={<Navigate to="/admin" replace />} />
                </Routes>
              </motion.div>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
