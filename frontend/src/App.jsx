import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { bootstrapAuth, clearUser, fetchSettings } from './store';
import { setAuthLostHandler } from './services/api';
import { ErrorBoundary, PageLoader, Toaster } from './components/common';
import CustomerLayout from './components/layout/CustomerLayout';
import Home from './pages/customer/Home';
import Menu from './pages/customer/Menu';
import { Activate, ForgotPassword, Login, Register, ResetPassword } from './pages/auth/AuthPages';
import { Contact, NotFound, Offers, OurStory, Privacy, RefundPolicy, Terms } from './pages/customer/StaticPages';

// Route-level code splitting; the admin bundle is never downloaded by customers.
const ProductDetail = lazy(() => import('./pages/customer/ProductDetail'));
const Cart = lazy(() => import('./pages/customer/Cart'));
const Checkout = lazy(() => import('./pages/customer/Checkout'));
const OrderTracking = lazy(() => import('./pages/customer/OrderTracking'));
const Account = lazy(() => import('./pages/account/Account'));
const AdminApp = lazy(() => import('./pages/admin/AdminApp'));
const DeliveryApp = lazy(() => import('./pages/delivery/DeliveryApp'));

function Boot({ children }) {
  const dispatch = useDispatch();
  const ready = useSelector((s) => s.auth.ready);
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref && /^[A-Za-z0-9]{4,12}$/.test(ref)) localStorage.setItem('aran_ref', ref.toUpperCase());
    setAuthLostHandler(() => dispatch(clearUser()));
    dispatch(fetchSettings());
    dispatch(bootstrapAuth());
  }, [dispatch]);
  // Public storefront pages render immediately (no full-screen loader before the hero); auth-dependent areas wait for the session check.
  const { pathname } = useLocation();
  const needsAuth = /^\/(account|admin|delivery|checkout|orders|login|register)/.test(pathname);
  return ready || !needsAuth ? children : <PageLoader />;
}

function RequireAuth({ children }) {
  const user = useSelector((s) => s.auth.user);
  const loc = useLocation();
  return user ? children : <Navigate to="/login" state={{ from: loc.pathname }} replace />;
}

function resolveMode() {
  const envMode = (import.meta.env.VITE_APP_MODE || '').toLowerCase();
  if (envMode === 'admin' || envMode === 'store') return envMode;
  if (typeof window !== 'undefined' && window.location.hostname.startsWith('admin.')) return 'admin';
  return 'all';
}

export default function App() {
  const mode = resolveMode();
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Boot>
          <Routes>
            {mode === 'admin' ? (
              <>
                <Route path="/" element={<Navigate to="/admin" replace />} />
                <Route path="/login" element={<Navigate to="/admin/login" replace />} />
                <Route path="/admin/login" element={<Login admin />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/activate" element={<Activate />} />
                <Route path="/admin/*" element={<Suspense fallback={<PageLoader />}><AdminApp /></Suspense>} />
                <Route path="*" element={<Navigate to="/admin" replace />} />
              </>
            ) : (
              <>
                {mode === 'all' && <Route path="/admin/login" element={<Login admin />} />}
                <Route path="/delivery" element={<Suspense fallback={<PageLoader />}><DeliveryApp /></Suspense>} />
                {mode === 'all' && <Route path="/admin/*" element={<Suspense fallback={<PageLoader />}><AdminApp /></Suspense>} />}
                <Route element={<CustomerLayout />}>
                  <Route index element={<Home />} />
                  <Route path="menu" element={<Menu />} />
                  <Route path="product/:slug" element={<ProductDetail />} />
                  <Route path="cart" element={<Cart />} />
                  <Route path="checkout" element={<Checkout />} />
                  <Route path="orders/:orderId" element={<OrderTracking />} />
                  <Route path="account/*" element={<RequireAuth><Account /></RequireAuth>} />
                  <Route path="login" element={<Login />} />
                  <Route path="register" element={<Register />} />
                  <Route path="forgot-password" element={<ForgotPassword />} />
                  <Route path="reset-password" element={<ResetPassword />} />
                  <Route path="activate" element={<Activate />} />
                  <Route path="our-story" element={<OurStory />} />
                  <Route path="offers" element={<Offers />} />
                  <Route path="contact" element={<Contact />} />
                  <Route path="terms" element={<Terms />} />
                  <Route path="privacy" element={<Privacy />} />
                  <Route path="refund-policy" element={<RefundPolicy />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </>
            )}
          </Routes>
        </Boot>
        <Toaster />
      </ErrorBoundary>
    </BrowserRouter>
  );
}
