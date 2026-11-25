import { useState } from 'react';
import { useFetch, useDocumentTitle } from '../../../hooks';
import { Badge, ErrorState, Skeleton } from '../../../components/common';
import { PageHeader, Select, StatCard, TrendChart, DataTable } from '../../../components/admin/kit';
import OrderDetail, { statusTone } from '../../../components/admin/OrderDetail';
import { STATUS_LABEL, fmtDate, formatINR } from '../../../utils';

export const RANGES = [['today', 'Today'], ['yesterday', 'Yesterday'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days'], ['custom', 'Custom range']];
export function RangePicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select label="Date range" value={value.range} onChange={(range) => onChange({ ...value, range })} options={RANGES} />
      {value.range === 'custom' && <><input type="date" aria-label="From" className="field !w-auto" value={value.from || ''} onChange={(e) => onChange({ ...value, from: e.target.value })} /><input type="date" aria-label="To" className="field !w-auto" value={value.to || ''} onChange={(e) => onChange({ ...value, to: e.target.value })} /></>}
    </div>
  );
}

export default function Dashboard() {
  useDocumentTitle('Dashboard');
  const [f, setF] = useState({ range: 'today' });
  const [open, setOpen] = useState(null);
  const ready = f.range !== 'custom' || (f.from && f.to);
  const { data, loading, error, reload } = useFetch('/admin/dashboard', f, { enabled: !!ready });
  const s = data?.summary;
  return (
    <>
      <PageHeader title="Dashboard" subtitle="Live business overview" actions={<RangePicker value={f} onChange={setF} />} />
      {error ? <ErrorState message={error} onRetry={reload} /> : loading || !s ? <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div> : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard i={0} label="Revenue (net collected)" value={formatINR(s.netCollectedPaise)} sub={`Gross ${formatINR(s.grossPaise)} · Discounts ${formatINR(s.discountPaise)} · Refunds ${formatINR(s.refundsPaise)}`} />
            <StatCard i={1} label="Total orders" value={s.orders} /><StatCard i={2} label="Pending" value={s.pending} tone={s.pending ? 'text-brand' : ''} /><StatCard i={3} label="In progress" value={s.confirmed} />
            <StatCard i={4} label="Completed" value={s.completed} tone="text-ok" /><StatCard i={5} label="Cancelled" value={s.cancelled} tone={s.cancelled ? 'text-bad' : ''} /><StatCard i={6} label="Avg. order value" value={formatINR(s.averageOrderValuePaise)} /><StatCard i={7} label="Low-stock items" value={data.lowStock.length} tone={data.lowStock.length ? 'text-bad' : ''} />
          </div>
          <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
            <section className="card p-5"><h2 className="mb-3 font-bold">Revenue & orders</h2><TrendChart data={data.trend.map((t) => ({ label: t._id, value: t.netPaise, secondary: t.orders }))} /></section>
            <section className="card p-5"><h2 className="mb-3 font-bold">Popular products</h2>{data.popular.length ? <ol className="space-y-2.5 text-sm">{data.popular.map((p, i) => <li key={p._id} className="flex items-center gap-3"><span className="grid size-6 place-items-center rounded-full bg-brand/10 text-xs font-bold text-brand">{i + 1}</span><span className="flex-1 truncate">{p.name}</span><span className="text-muted">{p.quantity} sold</span></li>)}</ol> : <p className="text-sm text-muted">No sales in this period.</p>}
              {data.lowStock.length > 0 && <><h3 className="mb-2 mt-5 font-bold text-bad">Low stock</h3><ul className="space-y-1 text-sm">{data.lowStock.map((l) => <li key={l._id} className="flex justify-between"><span>{l.productId?.name}</span><span className="font-semibold">{l.availableQuantity} left</span></li>)}</ul></>}</section>
          </div>
          <section><h2 className="mb-3 font-bold">Recent orders</h2>
            <DataTable rows={data.recent} onRowClick={(r) => setOpen(r._id)} empty="No orders yet" columns={[
              { key: 'orderNumber', label: 'Order', render: (r) => <strong>{r.orderNumber}</strong> }, { key: 'customer', label: 'Customer', render: (r) => r.customer?.name }, { key: 'type', label: 'Type', render: (r) => r.orderType },
              { key: 'total', label: 'Total', render: (r) => formatINR(r.pricingSnapshot.totalPaise) }, { key: 'status', label: 'Status', render: (r) => <Badge tone={statusTone(r.orderStatus)}>{STATUS_LABEL[r.orderStatus]}</Badge> }, { key: 'at', label: 'Placed', render: (r) => fmtDate(r.createdAt) }]} />
          </section>
        </div>
      )}
      <OrderDetail orderId={open} onClose={() => setOpen(null)} onChanged={reload} />
    </>
  );
}
