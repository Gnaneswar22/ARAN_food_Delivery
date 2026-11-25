import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { useDebounced, useDocumentTitle, useFetch } from '../../../hooks';
import { getSocket } from '../../../services/socket';
import { Badge, Pagination } from '../../../components/common';
import { DataTable, PageHeader, Select } from '../../../components/admin/kit';
import OrderDetail, { payTone, statusTone } from '../../../components/admin/OrderDetail';
import { STATUS_LABEL, fmtDate, formatINR } from '../../../utils';

const STATUSES = [['', 'All statuses'], ...Object.entries(STATUS_LABEL)];

export default function Orders({ fixed = {}, title = 'Orders', subtitle = 'Manage and fulfil customer orders' }) {
  useDocumentTitle(title);
  const [f, setF] = useState({ status: '', paymentMethod: '', orderType: '', from: '', to: '', search: '', page: 1 });
  const [open, setOpen] = useState(null);
  const [fresh, setFresh] = useState(new Set());
  const search = useDebounced(f.search);
  const { data, meta, loading, error, reload } = useFetch('/admin/orders', { ...f, search, ...fixed, limit: 20 });
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v, page: 1 }));

  useEffect(() => {
    const s = getSocket();
    const onNew = ({ orderId }) => { setFresh((p) => new Set(p).add(orderId)); reload(); };
    const onUpd = () => reload();
    s.on('order:new', onNew); s.on('order:updated', onUpd);
    return () => { s.off('order:new', onNew); s.off('order:updated', onUpd); };
  }, [reload]);

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1 sm:max-w-xs"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" /><input className="field pl-9" placeholder="Search order number" aria-label="Search order number" value={f.search} onChange={(e) => set('search')(e.target.value)} /></div>
        {!fixed.status && <Select label="Status" value={f.status} onChange={set('status')} options={STATUSES} />}
        <Select label="Payment" value={f.paymentMethod} onChange={set('paymentMethod')} options={[['', 'All payments'], ['online', 'Online'], ['cod', 'COD']]} />
        {!fixed.orderType && <Select label="Fulfilment" value={f.orderType} onChange={set('orderType')} options={[['', 'Delivery & pickup'], ['delivery', 'Delivery'], ['pickup', 'Pickup']]} />}
        <input type="date" aria-label="From date" className="field !w-auto" value={f.from} onChange={(e) => set('from')(e.target.value)} /><input type="date" aria-label="To date" className="field !w-auto" value={f.to} onChange={(e) => set('to')(e.target.value)} />
      </div>
      <DataTable rows={data} loading={loading} error={error} onRetry={reload} empty="No orders match your filters" onRowClick={(r) => { setOpen(r._id); setFresh((p) => { const n = new Set(p); n.delete(r._id); return n; }); }}
        rowClass={(r) => (fresh.has(r._id) || r.orderStatus === 'placed' ? 'bg-brand/5 font-medium' : '')}
        columns={[
          { key: 'n', label: 'Order', render: (r) => <span className="flex items-center gap-2"><strong>{r.orderNumber}</strong>{(fresh.has(r._id) || r.orderStatus === 'placed') && <Badge tone="orange">New</Badge>}</span> },
          { key: 'c', label: 'Customer', render: (r) => <span>{r.customer?.name}<span className="block text-xs text-muted">{r.customer?.phone}</span></span> },
          { key: 't', label: 'Type', render: (r) => <span className="capitalize">{r.orderType}</span> },
          { key: 'tot', label: 'Total', render: (r) => <span className="tabular-nums">{formatINR(r.pricingSnapshot.totalPaise)}</span> },
          { key: 'p', label: 'Payment', render: (r) => <Badge tone={payTone(r.paymentStatus)}>{r.paymentMethod === 'cod' ? 'COD' : 'Online'} · {r.paymentStatus.replace('_', ' ')}</Badge> },
          { key: 's', label: 'Status', render: (r) => <Badge tone={statusTone(r.orderStatus)}>{STATUS_LABEL[r.orderStatus]}</Badge> },
          { key: 'd', label: 'Placed', render: (r) => <span className="whitespace-nowrap text-muted">{fmtDate(r.createdAt)}</span> },
        ]} />
      <Pagination meta={meta} onPage={(page) => setF((s) => ({ ...s, page }))} />
      <OrderDetail orderId={open} onClose={() => setOpen(null)} onChanged={reload} />
    </>
  );
}
