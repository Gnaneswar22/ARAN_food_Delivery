import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { api, errMsg } from '../../services/api';
import { cx, formatINR } from '../../utils';
import { Skeleton, EmptyState, ErrorState } from '../common';

export const PageHeader = ({ title, subtitle, actions }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><h1 className="font-heading text-2xl font-extrabold sm:text-[28px]">{title}</h1>{subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}</div><div className="flex flex-wrap gap-2">{actions}</div></div>
);

export const StatCard = ({ label, value, sub, tone, i = 0 }) => (
  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.04 }} className="card p-4">
    <p className="text-[13px] text-muted">{label}</p><p className={cx('mt-1 font-heading text-2xl font-extrabold tabular-nums', tone)}>{value}</p>{sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
  </motion.div>
);

/** Responsive table: horizontal scroll on small screens. columns: [{key,label,render?,className?}] */
export function DataTable({ columns, rows, loading, error, onRetry, empty = 'Nothing to show', onRowClick, rowClass, rowKey = '_id' }) {
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (loading) return <div className="card space-y-2 p-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10" />)}</div>;
  if (!rows?.length) return <EmptyState title={empty} />;
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-sand bg-cream/60 text-[12px] uppercase tracking-wide text-muted"><tr>{columns.map((c) => <th key={c.key} className={cx('whitespace-nowrap px-4 py-3 font-semibold', c.className)}>{c.label}</th>)}</tr></thead>
        <tbody className="divide-y divide-sand/60">
          {rows.map((r) => (
            <tr key={r[rowKey]} onClick={onRowClick ? () => onRowClick(r) : undefined} className={cx('transition-colors hover:bg-cream/70', onRowClick && 'cursor-pointer', rowClass?.(r))}>
              {columns.map((c) => <td key={c.key} className={cx('px-4 py-3 align-middle', c.className)}>{c.render ? c.render(r) : r[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Cloudinary upload through the backend with preview, progress and validation. */
export function ImageUpload({ value, onChange, folder = 'products', label = 'Image', multiple = false }) {
  const input = useRef(null);
  const [progress, setProgress] = useState(null);
  const [err, setErr] = useState('');
  const list = multiple ? value || [] : value ? [value] : [];
  const upload = async (file) => {
    setErr('');
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) return setErr('Use a JPEG, PNG, WebP or AVIF image.');
    if (file.size > 5 * 1024 * 1024) return setErr('Image must be under 5MB.');
    const fd = new FormData();
    fd.append('image', file);
    try {
      setProgress(0);
      const r = await api.post(`/admin/uploads?folder=${folder}`, fd, { onUploadProgress: (e) => setProgress(Math.round((e.loaded / (e.total || file.size)) * 100)), timeout: 60000 });
      onChange(multiple ? [...list, r.data.data] : r.data.data);
    } catch (e) { setErr(errMsg(e)); } finally { setProgress(null); }
  };
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex flex-wrap gap-3">
        {list.map((im, i) => (
          <div key={im.url} className="relative size-24 overflow-hidden rounded-xl border border-sand"><img src={im.url} alt="" className="size-full object-cover" /><button type="button" aria-label="Remove image" onClick={() => onChange(multiple ? list.filter((_, k) => k !== i) : null)} className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-ink/70 text-white"><X className="size-3.5" /></button></div>
        ))}
        {(multiple || !list.length) && (
          <button type="button" onClick={() => input.current.click()} disabled={progress != null} className="grid size-24 place-items-center rounded-xl border-2 border-dashed border-sand text-muted hover:border-brand hover:text-brand">
            {progress != null ? <span className="flex flex-col items-center text-xs"><Loader2 className="size-5 animate-spin" />{progress}%</span> : <ImagePlus className="size-6" />}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) upload(f); }} />
      {err && <p role="alert" className="mt-1 text-xs text-bad">{err}</p>}
    </div>
  );
}

/** Dependency-free SVG chart: bars (orders) + line (revenue). data: [{label, value, secondary}] */
export function TrendChart({ data, height = 220, money = true }) {
  if (!data?.length) return <EmptyState title="No data for this period" />;
  const W = 640, H = height, pad = { l: 44, r: 12, t: 12, b: 28 };
  const max = Math.max(...data.map((d) => d.value), 1);
  const x = (i) => pad.l + (data.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (data.length - 1));
  const y = (v) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.value)}`).join(' ');
  const ticks = [0, 0.5, 1].map((t) => max * t);
  const bw = Math.min(28, (W - pad.l - pad.r) / data.length - 6);
  const smax = Math.max(...data.map((d) => d.secondary || 0), 1);
  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Revenue and orders trend">
        {ticks.map((t) => <g key={t}><line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#E9DFD0" strokeDasharray="3 4" /><text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#776B60">{money ? formatINR(Math.round(t)).replace(/\.\d+/, '') : Math.round(t)}</text></g>)}
        {data.map((d, i) => <rect key={`b${i}`} x={x(i) - bw / 2} width={bw} y={H - pad.b - ((d.secondary || 0) / smax) * (H - pad.t - pad.b) * 0.45} height={((d.secondary || 0) / smax) * (H - pad.t - pad.b) * 0.45} rx="3" fill="#E9DFD0" />)}
        <motion.path d={path} fill="none" stroke="#E87535" strokeWidth="2.5" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8 }} />
        {data.map((d, i) => <circle key={i} cx={x(i)} cy={y(d.value)} r="3.5" fill="#fff" stroke="#E87535" strokeWidth="2"><title>{`${d.label}: ${money ? formatINR(d.value) : d.value}${d.secondary != null ? ` · ${d.secondary} orders` : ''}`}</title></circle>)}
        {data.map((d, i) => (data.length <= 10 || i % Math.ceil(data.length / 8) === 0) && <text key={`l${i}`} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#776B60">{String(d.label).slice(-5)}</text>)}
      </svg>
      <p className="mt-1 flex items-center gap-4 text-xs text-muted"><span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-brand" />Revenue</span><span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-sand" />Orders</span></p>
    </div>
  );
}

export const Select = ({ value, onChange, options, label, className }) => (
  <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={cx('field !w-auto', className)}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
);

export const Toggle = ({ checked, onChange, label }) => (
  <label className="flex cursor-pointer items-center justify-between gap-3 text-sm"><span>{label}</span>
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={cx('relative h-6 w-11 rounded-full transition-colors', checked ? 'bg-brand' : 'bg-sand')}><span className={cx('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} /></button></label>
);
