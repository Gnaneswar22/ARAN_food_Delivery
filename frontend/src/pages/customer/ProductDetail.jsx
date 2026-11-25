import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ChevronRight, Clock, Utensils } from 'lucide-react';
import { useDocumentTitle, useFetch } from '../../hooks';
import { Badge, Button, ErrorState, FoodDot, ProductImage, QtyStepper, Skeleton } from '../../components/common';
import ProductCard, { useAddToCart, WishlistButton } from '../../components/products/ProductCard';
import { cx, formatINR } from '../../utils';

export default function ProductDetail() {
  const { slug } = useParams();
  const { data: p, loading, error, reload } = useFetch(`/products/${slug}`);
  useDocumentTitle(p?.name);
  const add = useAddToCart();
  const [img, setImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [sel, setSel] = useState({}); // groupId -> [choiceId]
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');

  if (loading) return <div className="container-x grid gap-8 py-10 lg:grid-cols-2"><Skeleton className="aspect-square" /><div className="space-y-4"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-24" /><Skeleton className="h-12" /></div></div>;
  if (error) return <div className="container-x py-16"><ErrorState message={error.includes('not found') ? 'This dish could not be found.' : error} onRetry={reload} /></div>;

  const toggle = (g, c) => setSel((s) => {
    const cur = s[g._id] || [];
    if (g.maxSelect === 1) return { ...s, [g._id]: [c._id] };
    return { ...s, [g._id]: cur.includes(c._id) ? cur.filter((x) => x !== c._id) : cur.length < g.maxSelect ? [...cur, c._id] : cur };
  });
  const chosen = p.customizations.flatMap((g) => (sel[g._id] || []).map((id) => ({ g, c: g.choices.find((c) => c._id === id) })));
  const unit = p.pricePaise + chosen.reduce((a, { c }) => a + c.pricePaise, 0);

  const onAdd = () => {
    const missing = p.customizations.find((g) => g.required && !(sel[g._id] || []).length);
    if (missing) { setErr(`Please choose an option for "${missing.name}"`); return; }
    setErr('');
    add(p, { quantity: qty, note: note || undefined, options: chosen.map(({ g, c }) => ({ groupId: g._id, choiceId: c._id, label: c.label, pricePaise: c.pricePaise })) });
  };
  const imgs = p.images?.length ? p.images : [{}];

  return (
    <div className="container-x py-6 lg:py-10">
      <nav className="mb-5 flex items-center gap-1 text-sm text-muted" aria-label="Breadcrumb"><Link to="/menu" className="hover:text-brand">Menu</Link><ChevronRight className="size-4" /><Link to={`/menu?category=${p.categoryId?.slug}`} className="hover:text-brand">{p.categoryId?.name}</Link><ChevronRight className="size-4" /><span className="truncate text-ink">{p.name}</span></nav>
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
        <div>
          <div className="group relative"><ProductImage src={imgs[img]?.url} alt={p.name} className="aspect-square w-full rounded-section" /><WishlistButton productId={p._id} className="absolute right-4 top-4" /></div>
          {imgs.length > 1 && <div className="mt-3 flex gap-2 overflow-x-auto">{imgs.map((im, i) => <button key={i} onClick={() => setImg(i)} aria-label={`Image ${i + 1}`} className={cx('size-20 shrink-0 overflow-hidden rounded-xl border-2', i === img ? 'border-brand' : 'border-transparent')}><ProductImage src={im.url} alt="" zoom={false} className="size-full" /></button>)}</div>}
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2"><FoodDot type={p.foodType} /><span className="text-sm capitalize text-muted">{p.foodType}</span>{p.isBestseller && <Badge tone="dark">Bestseller</Badge>}{p.available ? <Badge tone="green">Available</Badge> : <Badge tone="red">{p.inStock ? 'Unavailable' : 'Sold out'}</Badge>}</div>
          <h1 className="h-page mt-3">{p.name}</h1>
          <div className="mt-3 flex items-baseline gap-3"><span className="text-3xl font-extrabold tabular-nums">{formatINR(unit)}</span>{p.compareAtPricePaise > p.pricePaise && <span className="text-lg text-muted line-through">{formatINR(p.compareAtPricePaise)}</span>}</div>
          <p className="mt-4 leading-relaxed text-muted">{p.description}</p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted">
            {p.preparationTime > 0 && <span className="flex items-center gap-1.5"><Clock className="size-4 text-brand" />{p.preparationTime} min prep</span>}
            {p.portionSize && <span className="flex items-center gap-1.5"><Utensils className="size-4 text-brand" />{p.portionSize}</span>}
            {p.stockLeft != null && p.stockLeft <= 5 && p.stockLeft > 0 && <span className="font-semibold text-bad">Only {p.stockLeft} left</span>}
          </div>

          {p.customizations.map((g) => (
            <fieldset key={g._id} className="mt-6"><legend className="mb-2 text-[15px] font-bold">{g.name} {g.required ? <span className="text-xs font-medium text-bad">Required</span> : <span className="text-xs font-medium text-muted">Optional{g.maxSelect > 1 ? ` · up to ${g.maxSelect}` : ''}</span>}</legend>
              <div className="grid gap-2 sm:grid-cols-2">{g.choices.map((c) => { const on = (sel[g._id] || []).includes(c._id); return (
                <label key={c._id} className={cx('flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 text-sm transition-colors', on ? 'border-brand bg-brand/5' : 'border-sand bg-white hover:border-brand/50')}>
                  <span className="flex items-center gap-2.5"><input type={g.maxSelect === 1 ? 'radio' : 'checkbox'} name={g._id} checked={on} onChange={() => toggle(g, c)} className="accent-[var(--color-brand)]" />{c.label}</span>
                  {c.pricePaise > 0 && <span className="text-muted">+{formatINR(c.pricePaise)}</span>}
                </label>); })}</div>
            </fieldset>
          ))}

          <div className="mt-6"><label className="label" htmlFor="note">Special instructions (optional)</label><input id="note" className="field" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="E.g. less spicy" /></div>
          {err && <p role="alert" className="mt-3 text-sm text-bad">{err}</p>}
          <div className="mt-6 flex items-center gap-3"><QtyStepper value={qty} onChange={setQty} /><Button size="lg" className="flex-1" disabled={!p.available} onClick={onAdd}>{p.available ? `Add to cart · ${formatINR(unit * qty)}` : 'Currently unavailable'}</Button></div>

          {(p.ingredients?.length > 0 || p.allergens?.length > 0) && (
            <div className="mt-8 space-y-4 rounded-section border border-sand bg-white p-5">
              {p.ingredients?.length > 0 && <div><h2 className="mb-1.5 text-[15px] font-bold">Ingredients</h2><p className="text-sm text-muted">{p.ingredients.join(', ')}</p></div>}
              {p.allergens?.length > 0 && <div className="rounded-xl bg-bad/5 p-3.5"><h2 className="mb-1.5 flex items-center gap-1.5 text-[15px] font-bold text-bad"><AlertTriangle className="size-4" />Allergen information</h2><p className="text-sm">Contains: <strong>{p.allergens.join(', ')}</strong></p></div>}
            </div>
          )}
        </div>
      </div>
      {p.related?.length > 0 && <section className="mt-16"><h2 className="h-section mb-6">You may also like</h2><div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">{p.related.map((r) => <ProductCard key={r._id} product={r} />)}</div></section>}
    </div>
  );
}
