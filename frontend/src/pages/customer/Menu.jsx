import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, Search, X } from 'lucide-react';
import { useDebounced, useDocumentTitle, useFetch } from '../../hooks';
import { Button, EmptyState, ErrorState, Pagination } from '../../components/common';
import ProductCard, { ProductCardSkeleton } from '../../components/products/ProductCard';
import { cx } from '../../utils';
import { SplitText } from '../../components/common/motion';

const SORTS = [['', 'Recommended'], ['popular', 'Most popular'], ['price_asc', 'Price: low to high'], ['price_desc', 'Price: high to low'], ['newest', 'Newest']];
const TYPES = [['', 'All'], ['veg', 'Veg'], ['non-veg', 'Non-veg'], ['egg', 'Egg']];

export default function Menu() {
  useDocumentTitle('Menu');
  const [sp, setSp] = useSearchParams();
  const get = (k) => sp.get(k) || '';
  const set = (patch) => {
    const n = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k)));
    if (!('page' in patch)) n.delete('page');
    setSp(n, { replace: true });
  };
  const [q, setQ] = useState(get('q'));
  const dq = useDebounced(q);
  useEffect(() => { if (dq !== get('q')) set({ q: dq }); }, [dq]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setQ(get('q')); }, [sp.get('q')]); // eslint-disable-line react-hooks/exhaustive-deps
  const [filtersOpen, setFiltersOpen] = useState(false);

  const params = { category: get('category'), q: get('q'), foodType: get('foodType'), featured: get('featured'), bestseller: get('bestseller'), minPrice: get('minPrice'), maxPrice: get('maxPrice'), sort: get('sort'), page: get('page') || 1, limit: 12 };
  const cats = useFetch('/categories');
  const { data, meta, loading, error, reload } = useFetch('/products', params);
  const active = ['category', 'q', 'foodType', 'featured', 'bestseller', 'minPrice', 'maxPrice'].filter((k) => get(k));

  const Chip = ({ on, onClick, children }) => (
    <button onClick={onClick} aria-pressed={on} className={cx('h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors', on ? 'border-brand bg-brand text-white' : 'border-sand bg-white hover:border-brand')}>{children}</button>
  );

  return (
    <div className="container-x py-8 lg:py-12">
      <h1 className="h-page"><SplitText text="Our menu" accent={['menu']} /></h1>
      <p className="mt-2 text-muted">Freshly prepared, made to order.</p>

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1"><Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" /><input className="field pl-10" placeholder="Search dishes" aria-label="Search dishes" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="flex gap-2">
          <Button variant="outline" className="lg:hidden" onClick={() => setFiltersOpen((v) => !v)} aria-expanded={filtersOpen}><SlidersHorizontal className="size-4" />Filters{active.length > 0 && ` (${active.length})`}</Button>
          <select className="field !w-auto flex-1 lg:flex-none" aria-label="Sort by" value={get('sort')} onChange={(e) => set({ sort: e.target.value })}>{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </div>
      </div>

      <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Categories">
        <Chip on={!get('category')} onClick={() => set({ category: '' })}>All</Chip>
        {cats.data?.map((c) => <Chip key={c._id} on={get('category') === c.slug} onClick={() => set({ category: c.slug })}>{c.name}</Chip>)}
      </div>

      <div className={cx('mt-4 grid gap-4 rounded-section border border-sand bg-white p-4 sm:grid-cols-2 lg:grid-cols-4', filtersOpen ? 'grid' : 'hidden lg:grid')}>
        <div><span className="label">Food type</span><div className="flex flex-wrap gap-1.5">{TYPES.map(([v, l]) => <Chip key={v} on={get('foodType') === v} onClick={() => set({ foodType: v })}>{l}</Chip>)}</div></div>
        <div><span className="label">Price range (₹)</span><div className="flex items-center gap-2"><input className="field" type="number" min="0" inputMode="numeric" placeholder="Min" aria-label="Minimum price" value={get('minPrice')} onChange={(e) => set({ minPrice: e.target.value })} /><span>–</span><input className="field" type="number" min="0" inputMode="numeric" placeholder="Max" aria-label="Maximum price" value={get('maxPrice')} onChange={(e) => set({ maxPrice: e.target.value })} /></div></div>
        <div><span className="label">Collections</span><div className="flex flex-wrap gap-1.5"><Chip on={get('featured') === 'true'} onClick={() => set({ featured: get('featured') ? '' : 'true' })}>Featured</Chip><Chip on={get('bestseller') === 'true'} onClick={() => set({ bestseller: get('bestseller') ? '' : 'true', sort: get('bestseller') ? get('sort') : 'popular' })}>Best sellers</Chip></div></div>
        <div className="flex items-end">{active.length > 0 && <Button variant="ghost" onClick={() => setSp({}, { replace: true })}><X className="size-4" />Clear all filters</Button>}</div>
      </div>

      <div className="mt-8" aria-live="polite">
        {error ? <ErrorState message={error} onRetry={reload} /> : loading ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <ProductCardSkeleton key={i} />)}</div>
        ) : data.length === 0 ? (
          <EmptyState title="No dishes found" text="Try a different search or clear your filters." action={<Button variant="outline" onClick={() => setSp({}, { replace: true })}>Clear filters</Button>} />
        ) : (
          <>
            <p className="mb-4 text-sm text-muted">{meta.total} dish{meta.total === 1 ? '' : 'es'}</p>
            <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">{data.map((p) => <ProductCard key={p._id} product={p} />)}</div>
            <Pagination meta={meta} onPage={(p) => { set({ page: String(p) }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
          </>
        )}
      </div>
    </div>
  );
}
