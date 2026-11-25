import { useState } from 'react';
import { get, patch } from '../../../services/api';
import { useAction, useDebounced, useDocumentTitle, useFetch } from '../../../hooks';
import { Badge, Button, Modal, Pagination } from '../../../components/common';
import { DataTable, PageHeader } from '../../../components/admin/kit';
import OrderDetail from '../../../components/admin/OrderDetail';
import { STATUS_LABEL, fmtDate, formatINR } from '../../../utils';

export default function Customers() {
  useDocumentTitle('Customers');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const { data, meta, loading, error, reload } = useFetch('/admin/customers', { q: dq, page, limit: 20 });
  const [detail, setDetail] = useState(null);
  const [order, setOrder] = useState(null);
  const [run, busy] = useAction();
  return (
    <>
      <PageHeader title="Customers" subtitle="Contact details and order history (restricted to managers and owners)" />
      <input className="field mb-4 max-w-sm" placeholder="Search name, email or phone" aria-label="Search customers" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
      <DataTable rows={data} loading={loading} error={error} onRetry={reload} empty="No customers found" onRowClick={(c) => get(`/admin/customers/${c.id}`).then((r) => setDetail(r.data))} rowKey="id" columns={[
        { key: 'name', label: 'Customer', render: (c) => <strong>{c.name}</strong> }, { key: 'email', label: 'Email', render: (c) => c.email || '—' }, { key: 'phone', label: 'Phone', render: (c) => c.phone || '—' },
        { key: 'o', label: 'Orders', render: (c) => c.orders }, { key: 's', label: 'Total spent', render: (c) => formatINR(c.spentPaise) },
        { key: 'st', label: 'Account', render: (c) => <Badge tone={c.isActive ? 'green' : 'red'}>{c.isActive ? 'Active' : 'Suspended'}</Badge> }, { key: 'j', label: 'Joined', render: (c) => fmtDate(c.createdAt, { dateStyle: 'medium' }) },
      ]} />
      <Pagination meta={meta} onPage={setPage} />
      <Modal open={!!detail} onClose={() => setDetail(null)} wide title={detail?.name || ''}>
        {detail && <div className="space-y-4 text-sm"><p>{detail.email} · {detail.phone || 'no phone'}</p>
          <Button size="sm" variant={detail.isActive ? 'danger' : 'primary'} loading={busy} onClick={async () => { await run(() => patch(`/admin/customers/${detail.id}/status`, { isActive: !detail.isActive }), detail.isActive ? 'Account suspended' : 'Account reactivated'); setDetail({ ...detail, isActive: !detail.isActive }); reload(); }}>{detail.isActive ? 'Suspend account' : 'Reactivate account'}</Button>
          <h3 className="font-bold">Order history</h3>
          {detail.orders.length ? <ul className="divide-y divide-sand/60">{detail.orders.map((o) => <li key={o._id}><button className="flex w-full justify-between py-2 text-left hover:text-brand" onClick={() => setOrder(o._id)}><span>{o.orderNumber} · {fmtDate(o.createdAt)}</span><span>{formatINR(o.pricingSnapshot.totalPaise)} · {STATUS_LABEL[o.orderStatus]}</span></button></li>)}</ul> : <p className="text-muted">No orders yet.</p>}</div>}
      </Modal>
      <OrderDetail orderId={order} onClose={() => setOrder(null)} />
    </>
  );
}
