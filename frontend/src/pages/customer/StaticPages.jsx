import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ChevronDown, Clock, LifeBuoy, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { useDocumentTitle, useFetch } from '../../hooks';
import { Button, EmptyState, Reveal } from '../../components/common';
import ProductCard from '../../components/products/ProductCard';
import { FAQS, SUPPORT_TOPICS, useContact } from '../../config/siteContent';
import { ReviewsSection, STORY_PROMISES, StorySection } from './sections';

const Page = ({ title, children, lead }) => (
  <div className="container-x max-w-4xl py-10 lg:py-16"><Reveal><h1 className="h-page">{title}</h1>{lead && <p className="mt-3 text-lg text-muted">{lead}</p>}</Reveal><div className="prose-aran mt-8 space-y-4 leading-relaxed text-[15px] text-ink/85">{children}</div></div>
);

export function OurStory() {
  useDocumentTitle('Our story');
  const s = useSelector((st) => st.settings.data);
  return (
    <div className="container-x py-8 lg:py-12">
      <Reveal>
        <header className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#FFF1E4] via-[#FCE6D6] to-[#F9D5BC] px-6 py-10 sm:px-12 sm:py-14 lg:py-16">
          <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-white/40 blur-2xl" aria-hidden />
          <p className="eyebrow mb-3">Our story</p>
          <h1 className="h-page max-w-2xl">Good food. <span className="font-serif font-semibold italic text-brand">Great moments.</span></h1>
          <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-[#5B4A40]">A small kitchen with a simple idea: cook honestly, pack carefully and bring it to you fresh.</p>
        </header>
      </Reveal>

      <div className="mt-12 lg:mt-16"><StorySection story={s?.brand?.story} full /></div>

      <div className="mt-14 grid grid-cols-2 gap-3 sm:gap-4 lg:mt-20 lg:grid-cols-4">
        {STORY_PROMISES.map(([Icon, t, d], i) => (
          <Reveal key={t} delay={i * 0.06}>
            <div className="h-full rounded-[22px] bg-white p-5 shadow-card ring-1 ring-sand/60 sm:p-6">
              <span className="grid size-11 place-items-center rounded-xl bg-[#FDECE0] text-brand"><Icon className="size-5" /></span>
              <h3 className="mt-4 font-heading text-[17px] font-extrabold text-[#3E1A0B]">{t}</h3>
              <p className="mt-1 text-[13.5px] leading-snug text-muted">{d}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <ReviewsSection />
    </div>
  );
}

export function Offers() {
  useDocumentTitle('Offers');
  const { data } = useFetch('/products', { featured: 'true', limit: 8 });
  return (
    <div className="container-x py-10 lg:py-16"><h1 className="h-page">Offers & featured dishes</h1><p className="mt-2 text-muted">Hand-picked favourites. Promo codes can be applied in your cart.</p>
      <div className="mt-8">{data?.length ? <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">{data.map((p) => <ProductCard key={p._id} product={p} />)}</div> : <EmptyState title="No featured dishes right now" text="Check back soon for new offers." />}</div></div>
  );
}

export function Contact() {
  useDocumentTitle('Contact & help');
  const c = useContact();
  const cards = [
    [Phone, 'Call us', c.phone, `tel:${c.phone.replace(/[^+\d]/g, '')}`],
    [Mail, 'Email us', c.email, `mailto:${c.email}`],
    [MapPin, 'Visit us', c.address, c.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}`],
    [Clock, 'Opening hours', c.hours, null],
  ];
  return (
    <div className="container-x py-8 lg:py-12">
      <Reveal>
        <header className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#FFF1E4] via-[#FCE6D6] to-[#F9D5BC] px-6 py-10 sm:px-12 sm:py-14">
          <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-white/40 blur-2xl" aria-hidden />
          <p className="eyebrow mb-3">Contact & help</p>
          <h1 className="h-page max-w-2xl">We're here to <span className="italic text-brand">help</span></h1>
          <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-[#5B4A40]">Questions about an order, a dish or a payment? Reach us any way you like.</p>
          {c.whatsapp && <a href={`https://wa.me/${c.whatsapp}`} target="_blank" rel="noreferrer" className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-[#25D366] px-6 font-bold text-white"><MessageCircle className="size-5" />Chat on WhatsApp</a>}
        </header>
      </Reveal>

      <ul className="mt-8 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {cards.map(([Icon, label, value, href], i) => {
          const body = (
            <>
              <span className="grid size-11 place-items-center rounded-xl bg-[#FDECE0] text-brand"><Icon className="size-5" /></span>
              <p className="mt-4 font-heading text-[15px] font-bold text-[#3E1A0B]">{label}</p>
              <p className="mt-1 break-words text-[14.5px] leading-snug text-muted">{value}</p>
            </>
          );
          return (
            <Reveal key={label} delay={i * 0.05}>
              <li className="h-full list-none">
                {href ? <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="block h-full rounded-[22px] bg-white p-5 shadow-card ring-1 ring-sand/60 transition-transform hover:-translate-y-1">{body}</a> : <div className="h-full rounded-[22px] bg-white p-5 shadow-card ring-1 ring-sand/60">{body}</div>}
              </li>
            </Reveal>
          );
        })}
      </ul>

      <section className="mt-12 grid gap-3 sm:grid-cols-3 sm:gap-4" aria-label="How we can help">
        {SUPPORT_TOPICS.map(([t, d]) => (
          <div key={t} className="rounded-[22px] bg-[#FBF6F0] p-5 ring-1 ring-sand/70">
            <span className="inline-grid size-9 place-items-center rounded-lg bg-white text-brand shadow-sm"><LifeBuoy className="size-4" /></span>
            <h3 className="mt-3 font-heading text-[16px] font-bold text-[#3E1A0B]">{t}</h3>
            <p className="mt-1 text-[14px] leading-snug text-muted">{d}</p>
          </div>
        ))}
      </section>

      <section id="faq" className="mt-14 scroll-mt-28" aria-labelledby="faq-title">
        <p className="eyebrow mb-3">FAQs</p>
        <h2 id="faq-title" className="h-section">Quick answers</h2>
        <div className="mt-6 divide-y divide-sand/80 overflow-hidden rounded-[24px] bg-white shadow-card ring-1 ring-sand/60">
          {FAQS.map(([q, a]) => (
            <details key={q} className="group px-5 py-4 sm:px-7">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-heading text-[16px] font-bold text-[#3E1A0B] [&::-webkit-details-marker]:hidden">
                {q}<ChevronDown className="size-5 shrink-0 text-brand transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-2.5 max-w-3xl text-[15px] leading-relaxed text-muted">{a}</p>
            </details>
          ))}
        </div>
        <p className="mt-6 text-center text-[14px] text-muted">Still stuck? <a href={`mailto:${c.email}`} className="font-bold text-brand underline-offset-4 hover:underline">Email our team</a> or read our <Link to="/refund-policy" className="font-bold text-brand underline-offset-4 hover:underline">refund policy</Link>.</p>
      </section>
    </div>
  );
}

const LEGAL_NOTE = <p className="rounded-xl bg-sand/50 p-4 text-sm">This is a template provided with the platform. Have it reviewed by a legal professional and update it for your business before launch.</p>;
export const Terms = () => { useDocumentTitle('Terms'); return <Page title="Terms & conditions">{LEGAL_NOTE}<h2 className="h-section !text-xl">Orders</h2><p>Orders are accepted subject to availability and during our opening hours. Prices are in Indian Rupees and include or exclude taxes as shown at checkout.</p><h2 className="h-section !text-xl">Delivery & pickup</h2><p>Delivery is available within our serviceable area. Estimated times are approximate.</p><h2 className="h-section !text-xl">Allergens</h2><p>Allergen information is provided by ARAN.co on each product page. Please contact us before ordering if you have a severe allergy.</p></Page>; };
export const Privacy = () => { useDocumentTitle('Privacy'); return <Page title="Privacy policy">{LEGAL_NOTE}<p>We collect your name, contact details, addresses and order history to fulfil orders. Payments are processed by Razorpay; we never store card details. You may request deletion of your account data by contacting us.</p><p>We send promotional messages only if you opt in, and you can unsubscribe at any time.</p></Page>; };
export const RefundPolicy = () => { useDocumentTitle('Refund policy'); return <Page title="Refund policy">{LEGAL_NOTE}<p>If an order is cancelled before preparation, online payments are refunded in full to the original payment method, usually within 5–7 working days. If there is a quality or delivery issue, contact us with your order number and we will review it.</p></Page>; };

export function NotFound() {
  useDocumentTitle('Not found');
  return <div className="container-x py-16"><EmptyState title="Page not found" text="The page you're looking for doesn't exist." action={<Button as={Link} to="/">Back to home</Button>} /></div>;
}
