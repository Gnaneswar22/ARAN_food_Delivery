import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowRight, Bike, ChefHat, Leaf, MessageSquarePlus, Quote, ShieldCheck, Sparkles, Star } from 'lucide-react';
import { useFetch } from '../../hooks';
import { errMsg, post } from '../../services/api';
import { toast } from '../../store';
import { Reveal } from '../../components/common';

const DEFAULT_STORY = 'ARAN.co is a modern kitchen focused on fresh, thoughtfully prepared food.';

const VALUES = [
  [ChefHat, 'Made fresh to order', 'Every dish is prepared when you order it, never reheated.'],
  [Leaf, 'Honest ingredients', 'Carefully sourced and clearly labelled, so you know what you eat.'],
  [Bike, 'Delivered with care', 'Packed to arrive warm, intact and tidy, to your door or for pickup.'],
];

/** "Our story" block: photo collage + values. Used on the home page and the Our Story page. */
export function StorySection({ story, full = false }) {
  const text = story || DEFAULT_STORY;
  return (
    <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
      <Reveal>
        <div className="relative mx-auto w-full max-w-[520px] pb-10 pr-8 lg:pb-12">
          <div className="aspect-[4/5] overflow-hidden rounded-[32px] bg-[#FBE9DA] shadow-[0_24px_50px_-20px_rgba(74,30,14,0.35)]">
            <img src="/images/hero/classic-tiramisu.webp" alt="Classic tiramisu, freshly made at ARAN.co" loading="lazy" className="size-full object-cover object-[35%_50%]" />
          </div>
          <div className="absolute -bottom-0 right-0 aspect-square w-[46%] overflow-hidden rounded-[26px] border-[6px] border-[#F7F2E9] bg-white shadow-lift">
            <img src="/images/hero/veg-chips-salad.webp" alt="Fresh veg chips salad" loading="lazy" className="size-full object-cover" />
          </div>
          <div className="absolute left-4 top-6 flex items-center gap-2.5 rounded-2xl bg-white/95 px-4 py-3 shadow-lift backdrop-blur sm:-left-4">
            <span className="grid size-10 place-items-center rounded-xl bg-[#E6F2E4] text-ok"><Leaf className="size-5" /></span>
            <div className="leading-tight"><p className="text-[13px] font-extrabold text-[#3E1A0B]">Fresh, every day</p><p className="text-[12px] text-muted">Made to order</p></div>
          </div>
        </div>
      </Reveal>

      <div>
        <Reveal><p className="eyebrow mb-3">Our story</p></Reveal>
        <Reveal delay={0.05}><h2 className="h-section">Made with <span className="font-serif font-semibold italic text-brand">care,</span> served with pride</h2></Reveal>
        <Reveal delay={0.12}><p className="mt-5 max-w-xl text-[16px] leading-relaxed text-muted">{text}</p></Reveal>

        <ul className="mt-7 space-y-3.5">
          {VALUES.map(([Icon, t, d], i) => (
            <Reveal key={t} delay={0.18 + i * 0.07}>
              <li className="flex items-start gap-4 rounded-2xl bg-white/70 p-4 ring-1 ring-sand/70">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#FDECE0] text-brand"><Icon className="size-5" /></span>
                <div><h3 className="font-heading text-[16px] font-extrabold leading-tight text-[#3E1A0B]">{t}</h3><p className="mt-0.5 text-[14px] leading-snug text-muted">{d}</p></div>
              </li>
            </Reveal>
          ))}
        </ul>

        <Reveal delay={0.4}>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {full ? (
              <Link to="/menu" className="inline-flex h-12 items-center gap-2 rounded-full bg-brand px-7 font-bold text-white shadow-[0_10px_24px_rgb(232_117_53/0.3)] transition-colors hover:bg-brand-dark">Explore the menu<ArrowRight className="size-4" /></Link>
            ) : (
              <Link to="/our-story" className="group inline-flex h-12 items-center gap-2 rounded-full bg-ink px-7 font-bold text-white transition-colors hover:bg-brand">Discover our story<ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></Link>
            )}
            <Link to="/offers" className="inline-flex h-12 items-center rounded-full border-[1.5px] border-ink/30 px-6 font-bold transition-colors hover:border-ink">See offers</Link>
          </div>
        </Reveal>
      </div>
    </div>
  );
}

export const STORY_PROMISES = [
  [Sparkles, 'Fresh', 'Prepared to order, every time.'],
  [ShieldCheck, 'Trusted', 'Clear allergens and honest pricing.'],
  [Leaf, 'Quality', 'Ingredients we are proud to serve.'],
  [Bike, 'Reliable', 'Delivery or pickup, tracked live.'],
];

/* ------------------------------ Reviews ------------------------------ */

const Stars = ({ value, size = 'size-4' }) => (
  <span className="inline-flex gap-0.5 text-brand" role="img" aria-label={`${value} out of 5`}>
    {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`${size} ${i <= Math.round(value) ? 'fill-current' : 'text-sand'}`} />)}
  </span>
);

function ReviewForm({ onDone }) {
  const dispatch = useDispatch();
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await post('/account/reviews', { rating, comment: comment.trim() || undefined });
      dispatch(toast('Thank you! Your review will appear once approved.'));
      onDone();
    } catch (err) { dispatch(toast(errMsg(err), 'error')); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="mx-auto mt-8 max-w-xl rounded-[24px] bg-white p-5 shadow-card ring-1 ring-sand/70 sm:p-6">
      <p className="font-heading text-[17px] font-extrabold text-[#3E1A0B]">How was your order?</p>
      <div className="mt-3 flex gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" onMouseEnter={() => setHover(i)} onClick={() => setRating(i)} aria-label={`${i} star${i > 1 ? 's' : ''}`} aria-pressed={rating === i} className="p-0.5">
            <Star className={`size-8 transition-colors ${i <= (hover || rating) ? 'fill-brand text-brand' : 'text-sand'}`} />
          </button>
        ))}
      </div>
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={600} rows={3} placeholder="Tell others what you loved (optional)" className="field mt-4 resize-none" aria-label="Your review" />
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-[12px] text-muted">Only customers with a completed order can review.</p>
        <div className="flex gap-2">
          <button type="button" onClick={onDone} className="h-11 rounded-full px-5 text-sm font-bold text-ink hover:bg-sand/60">Cancel</button>
          <button type="submit" disabled={busy} className="h-11 rounded-full bg-brand px-6 text-sm font-bold text-white disabled:opacity-60">{busy ? 'Sending…' : 'Submit review'}</button>
        </div>
      </div>
    </form>
  );
}

/** Real, admin-approved customer reviews only (nothing is invented). Empty state invites the first review. */
export function ReviewsSection() {
  const { data } = useFetch('/reviews');
  const user = useSelector((s) => s.auth.user);
  const [writing, setWriting] = useState(false);
  const reviews = data || [];
  const avg = useMemo(() => (reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0), [reviews]);

  return (
    <section className="container-x mt-14 lg:mt-20" aria-labelledby="reviews-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Reveal><p className="eyebrow mb-3">Reviews</p></Reveal>
          <Reveal delay={0.05}><h2 id="reviews-title" className="h-section">Loved by our <span className="font-serif font-semibold italic text-brand">customers</span></h2></Reveal>
        </div>
        <div className="flex items-center gap-4">
          {reviews.length > 0 && (
            <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-2.5 shadow-card ring-1 ring-sand/70">
              <span className="font-heading text-[30px] font-extrabold leading-none text-[#3E1A0B]">{avg.toFixed(1)}</span>
              <div><Stars value={avg} /><p className="mt-0.5 text-[12px] text-muted">{reviews.length} review{reviews.length > 1 ? 's' : ''}</p></div>
            </div>
          )}
          {user ? (
            <button type="button" onClick={() => setWriting((v) => !v)} className="inline-flex h-11 items-center gap-2 rounded-full border-[1.5px] border-ink px-5 text-sm font-bold transition-colors hover:bg-ink hover:text-white"><MessageSquarePlus className="size-4" />Write a review</button>
          ) : (
            <Link to="/login" className="inline-flex h-11 items-center gap-2 rounded-full border-[1.5px] border-ink px-5 text-sm font-bold transition-colors hover:bg-ink hover:text-white"><MessageSquarePlus className="size-4" />Sign in to review</Link>
          )}
        </div>
      </div>

      {writing && <ReviewForm onDone={() => setWriting(false)} />}

      {reviews.length > 0 ? (
        <div className="mt-8 grid gap-4 sm:gap-5 md:grid-cols-3">
          {reviews.slice(0, 6).map((r, i) => (
            <Reveal key={r._id} delay={i * 0.06}>
              <figure className="relative flex h-full flex-col rounded-[24px] bg-white p-6 shadow-card ring-1 ring-sand/60">
                <Quote className="absolute right-5 top-5 size-8 text-brand/15" aria-hidden />
                <Stars value={r.rating} />
                <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed text-ink/85">“{r.comment || 'Great food!'}”</blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-full bg-[#FDECE0] font-heading text-[15px] font-extrabold text-brand">{(r.userId?.name || 'C').trim()[0].toUpperCase()}</span>
                  <div className="leading-tight"><p className="text-[14px] font-bold text-[#3E1A0B]">{r.userId?.name?.split(' ')[0] || 'Customer'}</p><p className="text-[12px] text-muted">Verified order</p></div>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      ) : (
        <Reveal>
          <div className="mt-8 flex flex-col items-center rounded-[28px] border border-dashed border-sand bg-white/60 px-6 py-12 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-[#FDECE0] text-brand"><Star className="size-7 fill-current" /></span>
            <h3 className="mt-4 font-heading text-[20px] font-extrabold text-[#3E1A0B]">Be the first to share your experience</h3>
            <p className="mt-1.5 max-w-md text-[14px] leading-relaxed text-muted">Order something delicious, then tell us what you thought. Reviews from verified orders appear here once approved.</p>
            <Link to="/menu" className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-brand px-6 text-sm font-bold text-white">Order now<ArrowRight className="size-4" /></Link>
          </div>
        </Reveal>
      )}
    </section>
  );
}
