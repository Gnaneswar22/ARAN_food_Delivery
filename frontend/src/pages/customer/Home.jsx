import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowRight, ArrowUpRight, Leaf, PackageCheck, Smartphone, Sparkles, Star } from 'lucide-react';
import { useDocumentTitle, useFetch } from '../../hooks';
import { post, errMsg } from '../../services/api';
import { toast } from '../../store';
import { Checkbox, EmptyState, ErrorState, Field, ProductImage, Reveal, ease } from '../../components/common';
import { Counter, Magnetic, Marquee, Parallax, SplitText, Wipe } from '../../components/common/motion';
import ProductCard, { ProductCardSkeleton } from '../../components/products/ProductCard';
import Hero from './Hero';
import { ReviewsSection, StorySection } from './sections';

const HIGHLIGHTS = [
  [Sparkles, 'Freshly Prepared', 'Cooked to order, never reheated.', 'bg-[#FFE9D9]'],
  [Leaf, 'Quality Ingredients', 'Carefully sourced, clearly labelled.', 'bg-[#E3EFE5]'],
  [PackageCheck, 'Carefully Packed', 'Arrives warm, intact and tidy.', 'bg-[#FFF3D1]'],
  [Smartphone, 'Easy Ordering', 'A few taps, then track it live.', 'bg-[#F6DFDC]'],
];

function Heading({ eyebrow, title, accent, link }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 sm:mb-10 sm:gap-4">
      <div><Reveal><p className="eyebrow mb-3">{eyebrow}</p></Reveal><h2 className="h-section max-w-2xl"><SplitText text={title} accent={accent} /></h2></div>
      {link && <Reveal><Link to={link[0]} className="group inline-flex items-center gap-2 rounded-full border-2 border-ink px-4 py-2 text-[13px] font-bold sm:px-5 sm:py-2.5 sm:text-sm transition-colors hover:bg-ink hover:text-white">{link[1]}<ArrowUpRight className="size-4 transition-transform group-hover:rotate-45" /></Link></Reveal>}
    </div>
  );
}
const Section = ({ children, className = '' }) => <section className={`container-x mt-14 lg:mt-20 ${className}`}>{children}</section>;

function ProductGrid({ q }) {
  const { data, loading, error, reload } = useFetch('/products', q);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading) return <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={i} />)}</div>;
  if (!data?.length) return <EmptyState title="Nothing here yet" text="Check back soon — our kitchen is cooking something up." />;
  return <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">{data.map((p, i) => <Reveal key={p._id} delay={i * 0.08} y={36}><ProductCard product={p} /></Reveal>)}</div>;
}

/** Desktop: hover-to-expand accordion. Mobile: 2-column grid. */
function Categories() {
  const { data, loading, error, reload } = useFetch('/categories');
  const [hover, setHover] = useState(0);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading) return <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">{Array.from({ length: 5 }, (_, i) => <div key={i} className="skeleton aspect-[3/4]" />)}</div>;
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 max-lg:[&>*:last-child:nth-child(odd)]:col-span-2 lg:flex lg:h-[380px] lg:gap-4" onMouseLeave={() => setHover(0)}>
      {data.map((c, i) => (
        <motion.div key={c._id} layout onMouseEnter={() => setHover(i)} animate={{ flexGrow: hover === i ? 3.2 : 1 }} transition={{ duration: 0.55, ease }} className="min-w-0 lg:flex-1 lg:basis-0">
          <Link to={`/menu?category=${c.slug}`} className="group relative block aspect-[4/5] overflow-hidden rounded-[22px] sm:aspect-[3/4] sm:rounded-[28px] lg:aspect-auto lg:h-full">
            <ProductImage src={c.image?.url} alt={c.name} className="size-full" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/10 to-transparent" />
            <span className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-white text-ink sm:right-4 sm:top-4 sm:size-11 transition-transform duration-300 group-hover:rotate-45"><ArrowUpRight className="size-5" /></span>
            <div className="absolute inset-x-0 bottom-0 p-3.5 text-white sm:p-5">
              <span className="font-mono text-xs text-white/60">0{i + 1}</span>
              <h3 className="font-heading text-[17px] font-extrabold leading-tight text-white sm:text-[20px] lg:text-[22px]">{c.name}</h3>
              {c.description && <motion.p initial={false} animate={{ height: hover === i ? 'auto' : 0, opacity: hover === i ? 1 : 0 }} className="hidden overflow-hidden text-sm text-white/80 lg:block">{c.description}</motion.p>}
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}

function HowItWorks() {
  const steps = [['Pick', 'Browse the menu and add what you love.', '🍽️'], ['Pay', 'UPI, card, net banking or cash on delivery.', '💳'], ['Enjoy', 'Track it live, then dig in — delivered or ready for pickup.', '🛵']];
  return (
    <Section>
      <Heading eyebrow="How it works" title="From craving to doorstep in three steps" accent={['three']} />
      <div className="relative grid gap-3 sm:gap-5 md:grid-cols-3">
        {steps.map(([t, d, e], i) => (
          <Reveal key={t} delay={i * 0.12} y={40}>
            <motion.div whileHover={{ y: -8 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }} className="relative h-full overflow-hidden rounded-[22px] bg-white p-5 shadow-card sm:rounded-[28px] sm:p-7 ring-1 ring-sand/60">
              <span className="font-heading text-[56px] font-extrabold leading-none text-sand/60 sm:text-[80px]">{i + 1}</span>
              <span className="absolute right-5 top-5 text-4xl sm:right-6 sm:top-6 sm:text-5xl">{e}</span>
              <h3 className="mt-1 font-heading text-[19px] font-extrabold sm:mt-2 sm:text-[22px]">{t}</h3>
              <p className="mt-1.5 text-[14px] text-muted sm:mt-2 sm:text-base">{d}</p>
            </motion.div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

function Stats({ settings }) {
  const dishes = useFetch('/products', { limit: 1 });
  const cats = useFetch('/categories');
  const items = [[dishes.meta?.total || 0, '', 'Dishes on the menu'], [cats.data?.length || 0, '', 'Categories'], [settings?.pickup?.prepMinutes || 20, ' min', 'Typical prep time'], [settings?.delivery?.radiusKm || 5, ' km', 'Delivery radius']];
  return (
    <Section>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[28px] bg-sand lg:grid-cols-4">
        {items.map(([n, s, l]) => <div key={l} className="bg-cream p-5 text-center lg:p-7"><Counter to={n} suffix={s} className="font-heading text-[34px] font-extrabold leading-none tracking-tight text-brand lg:text-[44px]" /><p className="mt-2 text-sm text-muted">{l}</p></div>)}
      </div>
    </Section>
  );
}

function Newsletter() {
  const dispatch = useDispatch();
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await post('/newsletter', { email, consent }); dispatch(toast('Subscribed! Watch your inbox for offers.')); setEmail(''); setConsent(false); }
    catch (err) { dispatch(toast(errMsg(err), 'error')); }
    finally { setBusy(false); }
  };
  return (
    <Section>
      <Reveal className="grid gap-8 rounded-[36px] bg-brand p-8 text-white sm:p-12 lg:grid-cols-2 lg:items-center">
        <div><h2 className="font-heading text-[28px] font-extrabold leading-tight tracking-tight text-white sm:text-[36px]">Hungry for <span className="font-serif font-medium italic">offers?</span></h2><p className="mt-3 max-w-sm text-white/85">New dishes and special deals, occasionally. Unsubscribe any time.</p></div>
        <form onSubmit={submit} className="space-y-3">
          <div className="flex flex-col gap-2 rounded-[28px] bg-white p-2 sm:flex-row sm:rounded-full">
            <input type="email" required placeholder="you@example.com" aria-label="Email address" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 flex-1 rounded-full bg-transparent px-5 text-ink outline-none placeholder:text-muted/60" />
            <button type="submit" disabled={!consent || busy} className="h-12 rounded-full bg-ink px-7 font-bold text-white transition-opacity disabled:opacity-50">{busy ? '…' : 'Subscribe'}</button>
          </div>
          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-white/90"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-4 accent-ink" />I agree to receive promotional emails from ARAN.co.</label>
        </form>
      </Reveal>
    </Section>
  );
}

export default function Home() {
  useDocumentTitle();
  const reduce = useReducedMotion();
  const settings = useSelector((s) => s.settings.data);
  const promo = settings?.brand?.promo;
  const best = useFetch('/products', { bestseller: 'true', limit: 4 });
  return (
    <>
      <Hero />

      <Section className="!mt-10 lg:!mt-12">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {HIGHLIGHTS.map(([Icon, t, d, bg], i) => (
            <Reveal key={t} delay={i * 0.08} y={30}>
              <motion.div whileHover={{ y: -6, rotate: i % 2 ? 1 : -1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }} className={`group h-full rounded-[22px] p-4 sm:rounded-[28px] sm:p-6 ${bg}`}>
                <span className="grid size-10 place-items-center rounded-xl bg-white text-brand shadow-sm sm:size-12 sm:rounded-2xl transition-transform duration-500 group-hover:rotate-[360deg]"><Icon className="size-6" /></span>
                <h3 className="mt-3 font-heading text-[15px] font-extrabold leading-tight sm:mt-6 sm:text-[19px]">{t}</h3><p className="mt-1 text-[12.5px] leading-snug text-ink/65 sm:mt-1.5 sm:text-sm">{d}</p>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section><Heading eyebrow="Categories" title="Whatever you're craving" accent={['craving']} link={['/menu', 'See everything']} /><Categories /></Section>
      <Section><Heading eyebrow="Handpicked" title="Featured dishes" accent={['Featured']} link={['/menu?featured=true', 'View all']} /><ProductGrid q={{ featured: 'true', limit: 4 }} /></Section>
      <HowItWorks />
      {best.data?.length > 0 && <Section><Heading eyebrow="Most ordered" title="Our best sellers" accent={['best']} link={['/menu?bestseller=true', 'View all']} /><ProductGrid q={{ bestseller: 'true', limit: 4 }} /></Section>}

      <section className="mt-24 overflow-hidden lg:mt-36" aria-label="Promotion">
        <Marquee speed={40} className="font-heading text-[clamp(40px,7vw,96px)] font-extrabold uppercase leading-none tracking-tighter" items={['Taste it', 'Love it', 'Order it'].map((t, i) => <><span className={i % 2 ? 'text-brand' : 'text-outline'}>{t}</span><span className="text-brand">✦</span></>)} />
        <div className="container-x mt-12 text-center">
          <h2 className="mx-auto max-w-3xl font-heading text-[32px] font-extrabold leading-tight tracking-tight sm:text-[48px]"><SplitText text={promo?.title || 'Something Delicious Is Waiting.'} accent={['Delicious']} /></h2>
          {promo?.subtitle && <p className="mx-auto mt-3 max-w-lg text-muted">{promo.subtitle}</p>}
          <Reveal className="mt-8"><Magnetic><Link to="/menu" className="group inline-flex h-14 items-center gap-3 rounded-full bg-ink pl-8 pr-2 font-bold text-white">{promo?.ctaLabel || 'Explore Our Menu'}<span className="grid size-10 place-items-center rounded-full bg-brand transition-transform group-hover:rotate-45"><ArrowUpRight className="size-5" /></span></Link></Magnetic></Reveal>
        </div>
      </section>

      <Stats settings={settings} />

      <Section><StorySection story={settings?.brand?.story} /></Section>

      <ReviewsSection />
      <Newsletter />
    </>
  );
}
