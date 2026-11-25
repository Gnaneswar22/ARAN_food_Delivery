import { Component, forwardRef, useEffect, useId, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Info, Loader2, Minus, Plus, UtensilsCrossed, X } from 'lucide-react';
import { cx } from '../../utils';
import { dismissToast } from '../../store';

export const ease = [0.22, 1, 0.36, 1];

/* ---------- Button ---------- */
const VARIANTS = {
  primary: 'bg-brand text-white hover:bg-brand-dark shadow-sm',
  dark: 'bg-ink text-white hover:bg-ink/90',
  outline: 'border border-sand bg-white text-ink hover:border-brand hover:text-brand',
  ghost: 'text-ink hover:bg-sand/50',
  danger: 'bg-bad text-white hover:bg-bad/90',
  soft: 'bg-brand/10 text-brand hover:bg-brand/15',
};
const SIZES = { sm: 'h-9 px-3.5 text-[14px]', md: 'h-11 px-5 text-[15px]', lg: 'h-12 px-7 text-[16px]' };
export const Button = forwardRef(function Button({ variant = 'primary', size = 'md', loading, disabled, className, children, as: Tag = 'button', ...p }, ref) {
  const reduce = useReducedMotion();
  const MotionTag = motion.create(Tag);
  return (
    <MotionTag
      ref={ref}
      whileHover={reduce || disabled || loading ? undefined : { y: -1 }}
      whileTap={reduce || disabled || loading ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.15 }}
      disabled={Tag === 'button' ? disabled || loading : undefined}
      aria-busy={loading || undefined}
      className={cx('inline-flex items-center justify-center gap-2 rounded-full font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-55 select-none', VARIANTS[variant], SIZES[size], className)}
      {...p}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </MotionTag>
  );
});

/* ---------- Form controls (react-hook-form friendly) ---------- */
export const Field = forwardRef(function Field({ label, error, hint, as: Tag = 'input', className, children, ...p }, ref) {
  const id = useId();
  return (
    <div className={className}>
      {label && <label htmlFor={id} className="label">{label}</label>}
      <Tag id={id} ref={ref} aria-invalid={!!error} aria-describedby={error ? `${id}-e` : undefined} className={cx('field', error && 'border-bad focus:border-bad focus:ring-bad/20')} {...p}>{children}</Tag>
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p id={`${id}-e`} role="alert" className="mt-1 text-xs text-bad">{error}</p>}
    </div>
  );
});

export function Checkbox({ label, ...p }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink">
      <input type="checkbox" className="mt-0.5 size-4 accent-[var(--color-brand)]" {...p} />
      <span>{label}</span>
    </label>
  );
}

/* ---------- Feedback ---------- */
export const Skeleton = ({ className }) => <div className={cx('skeleton', className)} aria-hidden />;
export const Spinner = ({ className }) => <Loader2 className={cx('size-5 animate-spin text-brand', className)} aria-label="Loading" />;
export const PageLoader = () => <div className="flex min-h-[40vh] items-center justify-center"><Spinner className="size-8" /></div>;

export function EmptyState({ icon: Icon = UtensilsCrossed, title, text, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-section border border-dashed border-sand bg-white/60 px-6 py-14 text-center">
      <div className="mb-4 grid size-14 place-items-center rounded-full bg-brand/10 text-brand"><Icon className="size-7" /></div>
      <h3 className="text-lg font-bold">{title}</h3>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
export function ErrorState({ message = 'Something went wrong', onRetry }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-section border border-bad/20 bg-bad/5 px-6 py-12 text-center">
      <AlertTriangle className="mb-3 size-8 text-bad" />
      <p className="font-semibold">{message}</p>
      {onRetry && <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

const BADGE = { green: 'bg-ok/10 text-ok', red: 'bg-bad/10 text-bad', orange: 'bg-brand/10 text-brand', gray: 'bg-sand/70 text-muted', dark: 'bg-ink text-white' };
export const Badge = ({ tone = 'gray', className, children }) => <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold', BADGE[tone], className)}>{children}</span>;

export const FoodDot = ({ type }) => {
  const c = type === 'non-veg' ? '#D94C45' : type === 'egg' ? '#E8A735' : '#477B53';
  return <span title={type} aria-label={type} className="inline-grid size-4 place-items-center rounded-[3px] border-[1.5px] bg-white" style={{ borderColor: c }}><span className="size-2 rounded-full" style={{ background: c }} /></span>;
};

/* ---------- Image with vivid branded fallback (until real photos are uploaded) ---------- */
const EMOJI = [[/burger|smash/i, '🍔'], [/pizza|margherita|farmhouse|pepperoni/i, '🍕'], [/bowl|grain|teriyaki|salad/i, '🥗'], [/fries|chips/i, '🍟'], [/bread|garlic/i, '🥖'], [/coffee/i, '☕'], [/soda|lime|juice|drink|shake|tea/i, '🥤'], [/pasta|noodle/i, '🍝'], [/cake|dessert|sweet/i, '🍰'], [/wrap|roll|sandwich/i, '🌯'], [/chicken/i, '🍗']];
const TINTS = ['from-[#FFE2CF] to-[#FBC9A6]', 'from-[#FFF0C9] to-[#FAD98C]', 'from-[#DCEBDD] to-[#B9D6BE]', 'from-[#F9D8D5] to-[#F2B3AE]', 'from-[#E9DFD0] to-[#D9C9B1]'];
export const foodEmoji = (s = '') => EMOJI.find(([r]) => r.test(s))?.[1] || '🍽️';
export function ProductImage({ src, alt = '', className, zoom = true }) {
  const tint = TINTS[[...alt].reduce((a, c) => a + c.charCodeAt(0), 0) % TINTS.length];
  return (
    <div className={cx('relative overflow-hidden bg-sand/50', className)}>
      {src ? (
        <img src={src} alt={alt} loading="lazy" decoding="async" className={cx('size-full object-cover', zoom && 'transition-transform duration-500 ease-out group-hover:md:scale-[1.08]')} />
      ) : (
        <div className={cx('relative grid size-full place-items-center overflow-hidden bg-gradient-to-br [container-type:size]', tint)} role="img" aria-label={alt}>
          <span className="absolute -right-[12%] -top-[12%] size-[55%] rounded-full bg-white/35" aria-hidden />
          <span className="absolute -bottom-[18%] -left-[10%] size-[60%] rounded-full bg-white/25" aria-hidden />
          <span className={cx('relative select-none leading-none drop-shadow-[0_12px_14px_rgba(40,35,31,0.18)]', zoom && 'transition-transform duration-500 group-hover:md:-rotate-6 group-hover:md:scale-110')} style={{ fontSize: '48cqmin' }}>{foodEmoji(alt)}</span>
        </div>
      )}
    </div>
  );
}
/* ---------- Motion helpers ---------- */
export function Reveal({ children, delay = 0, className, y = 20 }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} initial={reduce ? false : { opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.55, ease, delay }}>
      {children}
    </motion.div>
  );
}

export function QtyStepper({ value, onChange, min = 1, max = 50, size = 'md' }) {
  const s = size === 'sm' ? 'size-8' : 'size-10';
  return (
    <div className="inline-flex items-center rounded-btn border border-sand bg-white" role="group" aria-label="Quantity">
      <button type="button" className={cx(s, 'grid place-items-center rounded-l-btn text-ink hover:bg-sand/50 disabled:opacity-40')} onClick={() => onChange(value - 1)} disabled={value <= min} aria-label="Decrease quantity"><Minus className="size-4" /></button>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={value} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 6, opacity: 0 }} transition={{ duration: 0.12 }} className="w-8 text-center text-sm font-semibold tabular-nums" aria-live="polite">{value}</motion.span>
      </AnimatePresence>
      <button type="button" className={cx(s, 'grid place-items-center rounded-r-btn text-ink hover:bg-sand/50 disabled:opacity-40')} onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="Increase quantity"><Plus className="size-4" /></button>
    </div>
  );
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, children, wide, footer }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus?.(); };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          <div className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
          <motion.div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}
            initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }} transition={{ duration: 0.25, ease }}
            className={cx('relative flex max-h-[92dvh] w-full flex-col rounded-t-[22px] bg-white shadow-lift outline-none sm:rounded-modal', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}>
            <div className="flex items-center justify-between border-b border-sand/70 px-5 py-4">
              <h2 className="text-lg font-bold">{title}</h2>
              <button onClick={onClose} className="grid size-9 place-items-center rounded-full hover:bg-sand/60" aria-label="Close"><X className="size-5" /></button>
            </div>
            <div className="overflow-y-auto px-5 py-4">{children}</div>
            {footer && <div className="flex justify-end gap-2 border-t border-sand/70 px-5 py-3">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ConfirmModal({ open, onClose, onConfirm, title, text, confirmLabel = 'Confirm', danger, loading }) {
  return (
    <Modal open={open} onClose={onClose} title={title} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>{confirmLabel}</Button></>}>
      <p className="text-sm text-muted">{text}</p>
    </Modal>
  );
}

/* ---------- Toasts ---------- */
const TOAST_ICON = { success: CheckCircle2, error: AlertTriangle, info: Info };
function ToastItem({ t }) {
  const dispatch = useDispatch();
  useEffect(() => { const id = setTimeout(() => dispatch(dismissToast(t.id)), t.type === 'error' ? 6000 : 3200); return () => clearTimeout(id); }, [t.id, t.type, dispatch]);
  const Icon = TOAST_ICON[t.type] || Info;
  return (
    <motion.div layout initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }} transition={{ duration: 0.25, ease }}
      role={t.type === 'error' ? 'alert' : 'status'} className="pointer-events-auto flex max-w-sm items-start gap-3 rounded-xl border border-sand bg-white px-4 py-3 shadow-lift">
      <Icon className={cx('mt-0.5 size-5 shrink-0', t.type === 'success' && 'text-ok', t.type === 'error' && 'text-bad', t.type === 'info' && 'text-brand')} />
      <p className="text-sm font-medium">{t.message}</p>
    </motion.div>
  );
}
export function Toaster() {
  const toasts = useSelector((s) => s.ui.toasts);
  return (
    <div className="pointer-events-none fixed right-3 top-3 z-[90] flex flex-col gap-2 sm:right-5 sm:top-5" aria-live="polite">
      <AnimatePresence initial={false}>{toasts.map((t) => <ToastItem key={t.id} t={t} />)}</AnimatePresence>
    </div>
  );
}

/* ---------- Pagination ---------- */
export function Pagination({ meta, onPage }) {
  if (!meta || meta.pages <= 1) return null;
  return (
    <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Pagination">
      <Button variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}><ChevronLeft className="size-4" />Prev</Button>
      <span className="text-sm text-muted">Page {meta.page} of {meta.pages}</span>
      <Button variant="outline" size="sm" disabled={meta.page >= meta.pages} onClick={() => onPage(meta.page + 1)}>Next<ChevronRight className="size-4" /></Button>
    </nav>
  );
}

/* ---------- Error boundary ---------- */
export class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { console.error(error); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid min-h-[50vh] place-items-center p-6">
        <ErrorState message="This page ran into a problem." onRetry={() => { this.setState({ error: null }); }} />
      </div>
    );
  }
}
