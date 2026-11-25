import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { loginThunk, toast } from '../../store';
import { post, errMsg } from '../../services/api';
import { resetSocket } from '../../services/socket';
import { Button, Checkbox, Field } from '../../components/common';
import { Logo } from '../../components/layout/CustomerLayout';
import PhoneAuth from '../../components/auth/PhoneAuth';
import { useDocumentTitle } from '../../hooks';

function Shell({ title, subtitle, children, footer }) {
  return (
    <div className="container-x grid min-h-[70vh] place-items-center py-10">
      <div className="card w-full min-w-0 max-w-md p-5 sm:p-8">
        <div className="mb-6 text-center"><Logo />{title && <h1 className="mt-4 font-heading text-2xl font-extrabold">{title}</h1>}{subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}</div>
        {children}
        {footer && <p className="mt-6 text-center text-sm text-muted">{footer}</p>}
      </div>
    </div>
  );
}

const password = z.string().min(8, 'At least 8 characters').regex(/[A-Za-z]/, 'Include a letter').regex(/\d/, 'Include a number');

const homeFor = (u, fallback) => (u?.role === 'delivery' ? '/delivery' : ['owner', 'manager', 'staff'].includes(u?.role) ? '/admin' : fallback);

export function Login({ admin }) {
  useDocumentTitle(admin ? 'Admin sign in' : 'Sign in');
  const dispatch = useDispatch();
  const nav = useNavigate();
  const loc = useLocation();
  const user = useSelector((s) => s.auth.user);
  const [usePassword, setUsePassword] = useState(false);
  const [err, setErr] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(z.object({ identifier: z.string().min(3, 'Enter your email or phone'), password: z.string().min(1, 'Enter your password') })) });
  const dest = loc.state?.from || '/account';
  if (user && (!admin || user.role !== 'customer')) return <Navigate to={homeFor(user, dest)} replace />;
  const submit = async (v) => {
    setErr('');
    const r = await dispatch(loginThunk({ ...v, admin }));
    if (r.error) return setErr(r.payload || 'Login failed');
    resetSocket();
    nav(homeFor(r.payload, dest), { replace: true });
  };
  const passwordForm = (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <Field label="Email or mobile number" autoComplete="username" error={errors.identifier?.message} {...register('identifier')} />
      <Field label="Password" type="password" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
      {err && <p role="alert" className="rounded-lg bg-bad/10 p-3 text-sm text-bad">{err}</p>}
      <Button type="submit" className="w-full" loading={isSubmitting}>Sign in</Button>
      {!admin && <p className="text-center text-sm"><Link to="/forgot-password" className="text-brand">Forgot password?</Link></p>}
    </form>
  );
  if (admin) return <Shell title="Admin sign in" subtitle="ARAN.co management console">{passwordForm}</Shell>;
  return (
    <Shell footer={<>{usePassword ? <button className="font-semibold text-brand" onClick={() => setUsePassword(false)}>Sign in with mobile OTP</button> : <button className="font-semibold text-muted hover:text-ink" onClick={() => setUsePassword(true)}>Use email & password instead</button>}</>}>
      {usePassword ? <><h1 className="mb-4 text-center font-heading text-2xl font-extrabold">Sign in with password</h1>{passwordForm}</> : <PhoneAuth onSuccess={(u) => nav(homeFor(u, dest), { replace: true })} />}
    </Shell>
  );
}

/** New accounts are created by verifying a mobile number; the old sign-up page redirects there. */
export const Register = () => { const loc = useLocation(); return <Navigate to="/login" state={loc.state} replace />; };
export function ForgotPassword() {
  useDocumentTitle('Forgot password');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(z.object({ email: z.string().email('Enter a valid email') })) });
  const submit = async (v) => { try { await post('/auth/forgot-password', v); setSent(true); } catch (e) { setErr(errMsg(e)); } };
  return (
    <Shell title="Reset your password" subtitle="We'll email you a reset link." footer={<Link to="/login" className="font-semibold text-brand">Back to sign in</Link>}>
      {sent ? <p role="status" className="rounded-lg bg-ok/10 p-4 text-sm text-ok">If an account exists for that email, a reset link is on its way.</p> : (
        <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
          <Field label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
          {err && <p role="alert" className="text-sm text-bad">{err}</p>}
          <Button type="submit" className="w-full" loading={isSubmitting}>Send reset link</Button>
        </form>)}
    </Shell>
  );
}

export function ResetPassword() {
  useDocumentTitle('Reset password');
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const dispatch = useDispatch();
  const [err, setErr] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(z.object({ password, confirm: z.string() }).refine((d) => d.password === d.confirm, { path: ['confirm'], message: 'Passwords do not match' })) });
  const submit = async (v) => {
    try { await post('/auth/reset-password', { token: sp.get('token'), password: v.password }); dispatch(toast('Password updated. Please sign in.')); nav('/login', { replace: true }); }
    catch (e) { setErr(errMsg(e)); }
  };
  return (
    <Shell title="Choose a new password">
      <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        <Field label="New password" type="password" autoComplete="new-password" error={errors.password?.message} {...register('password')} />
        <Field label="Confirm password" type="password" autoComplete="new-password" error={errors.confirm?.message} {...register('confirm')} />
        {err && <p role="alert" className="text-sm text-bad">{err}</p>}
        <Button type="submit" className="w-full" loading={isSubmitting}>Update password</Button>
      </form>
    </Shell>
  );
}

export function Activate() {
  const [sp] = useSearchParams();
  const [state, setState] = useState('loading');
  useEffect(() => { post('/auth/activate', { token: sp.get('token') }).then(() => setState('ok')).catch(() => setState('bad')); }, [sp]);
  return (
    <Shell title={state === 'ok' ? 'Account activated' : state === 'bad' ? 'Link invalid or expired' : 'Activating…'}>
      {state !== 'loading' && <Button as={Link} to="/login" className="w-full">Continue to sign in</Button>}
    </Shell>
  );
}
