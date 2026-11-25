import { useEffect, useRef, useState } from 'react';
import { animate, motion, useInView, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion';
import { ease } from './index';
import { cx } from '../../utils';

/** Thin brand progress bar tied to page scroll. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const x = useSpring(scrollYProgress, { stiffness: 140, damping: 28, restDelta: 0.001 });
  return <motion.div style={{ scaleX: x }} className="fixed inset-x-0 top-0 z-[95] h-[3px] origin-left bg-brand" aria-hidden />;
}

/** Words rise out of a mask, staggered. Use `accent` words for the serif italic style. */
export function SplitText({ text, className, delay = 0, accent = [], as: Tag = 'span', once = true }) {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const inView = useInView(ref, { once, margin: '-10% 0px' });
  return (
    <Tag ref={ref} className={className} aria-label={text}>
      {text.split(' ').map((w, i) => (
        <span key={i} className="mr-[0.24em] inline-block overflow-hidden pb-[0.12em] align-bottom" aria-hidden>
          <motion.span className={cx('inline-block', accent.includes(w) && 'font-serif italic font-medium text-brand')} initial={reduce ? false : { y: '115%', rotate: 4 }} animate={inView || reduce ? { y: 0, rotate: 0 } : {}} transition={{ duration: 0.8, ease, delay: delay + i * 0.07 }}>{w}</motion.span>
        </span>
      ))}
    </Tag>
  );
}

/** Counts up when scrolled into view. */
export function Counter({ to, suffix = '', prefix = '', duration = 1.6, className }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [v, setV] = useState(0);
  useEffect(() => { if (inView) { const c = animate(0, to, { duration, ease, onUpdate: (x) => setV(Math.round(x)) }); return () => c.stop(); } }, [inView, to, duration]);
  return <span ref={ref} className={className}>{prefix}{v.toLocaleString('en-IN')}{suffix}</span>;
}

/** Element drifts toward the pointer (desktop only). */
export function Magnetic({ children, strength = 0.25, className }) {
  const reduce = useReducedMotion();
  const canHover = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches;
  const x = useMotionValue(0), y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 16 }), sy = useSpring(y, { stiffness: 220, damping: 16 });
  if (reduce || !canHover) return <span className={className}>{children}</span>;
  return (
    <motion.span style={{ x: sx, y: sy }} className={cx('inline-block', className)}
      onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); x.set((e.clientX - r.left - r.width / 2) * strength); y.set((e.clientY - r.top - r.height / 2) * strength); }}
      onMouseLeave={() => { x.set(0); y.set(0); }}>{children}</motion.span>
  );
}

/** Scroll-linked vertical parallax (transform only). */
export function Parallax({ children, offset = 40, className }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [offset, -offset]);
  return <motion.div ref={ref} style={reduce ? undefined : { y }} className={className}>{children}</motion.div>;
}

/** Reveal with a smooth GPU transform + opacity transition. */
export function Wipe({ children, className, delay = 0 }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} initial={reduce ? false : { opacity: 0, y: 24, scale: 0.98 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.55, ease, delay }}>
      {children}
    </motion.div>
  );
}

export function Marquee({ items, speed = 30, reverse, className }) {
  return (
    <div className={cx('overflow-hidden', className)} aria-hidden>
      <div className="marquee flex w-max" style={{ animationDuration: `${speed}s`, animationDirection: reverse ? 'reverse' : 'normal' }}>
        {[0, 1].map((k) => <div key={k} className="flex shrink-0 items-center">{items.map((t, i) => <span key={i} className="flex items-center gap-8 pr-8">{t}</span>)}</div>)}
      </div>
    </div>
  );
}

/** Rotating circular text badge. */
export function SpinBadge({ text = 'FRESH • PREMIUM • DELIVERED • ', className }) {
  return (
    <div className={className} aria-hidden>
     <div className="relative grid size-full place-items-center">
      <svg viewBox="0 0 120 120" className="spin-slow size-full">
        <defs><path id="circ" d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0" /></defs>
        <text fontSize="11.5" fontWeight="800" letterSpacing="2.2" fill="currentColor" className="font-heading"><textPath href="#circ" textLength="272" lengthAdjust="spacing">{text}</textPath></text>
      </svg>
      <span className="absolute grid size-1/3 place-items-center rounded-full bg-brand text-white">↗</span>
     </div>
    </div>
  );
}
