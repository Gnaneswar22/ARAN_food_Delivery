import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDispatch } from 'react-redux';
import { ArrowLeft, ShieldCheck, Smartphone } from 'lucide-react';
import { patch, post, errMsg, setAccessToken } from '../../services/api';
import { completeLogin } from '../../store';
import { resetSocket } from '../../services/socket';
import { Button, Field, ease } from '../common';

const RESEND_SECONDS = 30;

/** Mobile-number sign-in: number → 6-digit OTP → (new users) name. Works for customers and delivery partners. */
export default function PhoneAuth({ onSuccess, title = 'Sign in with your mobile', subtitle = 'We’ll text you a 6-digit code to verify your number.' }) {
  const dispatch = useDispatch();
  const [step, setStep] = useState('phone'); // phone | otp | name
  const [phone, setPhone] = useState('');
  const [digits, setDigits] = useState(Array(6).fill(''));
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [user, setUserState] = useState(null);
  const boxes = useRef([]);

  useEffect(() => { if (cooldown <= 0) return undefined; const t = setTimeout(() => setCooldown((c) => c - 1), 1000); return () => clearTimeout(t); }, [cooldown]);
  useEffect(() => { if (step === 'otp') boxes.current[0]?.focus(); }, [step]);

  const sendOtp = async (e) => {
    e?.preventDefault();
    if (!/^[6-9]\d{9}$/.test(phone)) return setError('Enter a valid 10-digit mobile number');
    setBusy(true); setError('');
    try {
      const { data } = await post('/auth/otp/request', { phone });
      setDevOtp(data.devOtp || '');
      setCooldown(data.resendInSeconds || RESEND_SECONDS);
      setDigits(Array(6).fill(''));
      setStep('otp');
    } catch (err) {
      setError(errMsg(err));
      const wait = err.response?.data?.error?.details?.retryAfter;
      if (wait) setCooldown(wait);
    } finally { setBusy(false); }
  };

  const verify = async (code) => {
    setBusy(true); setError('');
    try {
      const ref = localStorage.getItem('aran_ref');
      const { data } = await post('/auth/otp/verify', { phone, code, ...(ref ? { referralCode: ref } : {}) });
      if (data.isNew) localStorage.removeItem('aran_ref');
      resetSocket();
      if (data.needsName) { setAccessToken(data.accessToken); setUserState({ user: data.user, accessToken: data.accessToken }); setStep('name'); } // finish login after the name step
      else { await dispatch(completeLogin(data)); onSuccess?.(data.user); }
    } catch (err) { setError(errMsg(err)); setDigits(Array(6).fill('')); boxes.current[0]?.focus(); }
    finally { setBusy(false); }
  };

  const setDigit = (i, v) => {
    const d = v.replace(/\D/g, '');
    if (!d) { setDigits((a) => a.map((x, k) => (k === i ? '' : x))); return; }
    const next = [...digits];
    d.split('').slice(0, 6 - i).forEach((c, k) => { next[i + k] = c; }); // handles paste / SMS autofill
    setDigits(next);
    const last = Math.min(5, i + d.length);
    boxes.current[last]?.focus();
    if (next.every(Boolean)) verify(next.join(''));
  };
  const onKey = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) boxes.current[i - 1]?.focus();
    if (e.key === 'ArrowLeft' && i > 0) boxes.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < 5) boxes.current[i + 1]?.focus();
  };

  const saveName = async (e) => {
    e.preventDefault();
    if (name.trim().length < 2) return setError('Please enter your name');
    setBusy(true); setError('');
    try { const { data } = await patch('/account/me', { name: name.trim() }); await dispatch(completeLogin({ user: data, accessToken: user.accessToken })); onSuccess?.(data); }
    catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  };

  const slide = { initial: { opacity: 0, x: 24 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -24 }, transition: { duration: 0.25, ease } };
  return (
    <div>
      <AnimatePresence mode="wait" initial={false}>
        {step === 'phone' && (
          <motion.form key="phone" {...slide} onSubmit={sendOtp} className="space-y-4" noValidate>
            <div className="text-center"><span className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-brand/10 text-brand"><Smartphone className="size-7" /></span><h2 className="font-heading text-2xl font-extrabold">{title}</h2><p className="mt-1 text-sm text-muted">{subtitle}</p></div>
            <div>
              <label htmlFor="phone" className="label">Mobile number</label>
              <div className="flex overflow-hidden rounded-[10px] border border-sand bg-white focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
                <span className="grid place-items-center border-r border-sand bg-cream px-3.5 text-[15px] font-semibold">+91</span>
                <input id="phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} aria-invalid={!!error} className="w-full bg-transparent px-3.5 py-3 text-[17px] tracking-wide outline-none" />
              </div>
            </div>
            {error && <p role="alert" className="rounded-lg bg-bad/10 p-3 text-sm text-bad">{error}</p>}
            <Button type="submit" size="lg" className="w-full" loading={busy} disabled={phone.length !== 10}>Send OTP</Button>
            <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted"><ShieldCheck className="size-3.5" />We never share your number. Standard SMS rates may apply.</p>
          </motion.form>
        )}

        {step === 'otp' && (
          <motion.div key="otp" {...slide} className="space-y-5">
            <button type="button" onClick={() => { setStep('phone'); setError(''); }} className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="size-4" />Change number</button>
            <div className="text-center"><h2 className="font-heading text-2xl font-extrabold">Enter the 6-digit code</h2><p className="mt-1 text-sm text-muted">Sent to +91 {phone.slice(0, 5)} {phone.slice(5)}</p></div>
            <div className="flex justify-center gap-1.5 sm:gap-2.5" role="group" aria-label="One-time password">
              {digits.map((d, i) => (
                <input key={i} ref={(el) => (boxes.current[i] = el)} value={d} inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'} maxLength={6} aria-label={`Digit ${i + 1}`} disabled={busy}
                  onChange={(e) => setDigit(i, e.target.value)} onKeyDown={(e) => onKey(i, e)} onFocus={(e) => e.target.select()}
                  className={`size-11 min-[380px]:size-12 rounded-xl border-2 bg-white text-center font-heading text-2xl font-extrabold outline-none transition-colors sm:size-14 ${d ? 'border-brand' : 'border-sand'} focus:border-brand focus:ring-4 focus:ring-brand/15 ${error ? 'border-bad' : ''}`} />
              ))}
            </div>
            {devOtp && <p className="rounded-lg bg-brand/10 p-3 text-center text-sm">Developer mode — no SMS provider is configured. Your code is <strong className="font-mono tracking-widest">{devOtp}</strong></p>}
            {error && <p role="alert" className="text-center text-sm text-bad">{error}</p>}
            <Button size="lg" className="w-full" loading={busy} disabled={digits.some((x) => !x)} onClick={() => verify(digits.join(''))}>Verify & continue</Button>
            <p className="text-center text-sm text-muted">{cooldown > 0 ? <>Resend code in <strong className="tabular-nums">{cooldown}s</strong></> : <button type="button" onClick={sendOtp} className="font-semibold text-brand hover:underline">Resend code</button>}</p>
          </motion.div>
        )}

        {step === 'name' && (
          <motion.form key="name" {...slide} onSubmit={saveName} className="space-y-4" noValidate>
            <div className="text-center"><h2 className="font-heading text-2xl font-extrabold">Welcome to ARAN.co 🎉</h2><p className="mt-1 text-sm text-muted">Your number is verified. What should we call you?</p></div>
            <Field label="Your name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            {error && <p role="alert" className="text-sm text-bad">{error}</p>}
            <Button type="submit" size="lg" className="w-full" loading={busy}>Continue</Button>
            <button type="button" onClick={async () => { await dispatch(completeLogin(user)); onSuccess?.(user.user); }} className="w-full text-center text-sm text-muted hover:text-ink">Skip for now</button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
