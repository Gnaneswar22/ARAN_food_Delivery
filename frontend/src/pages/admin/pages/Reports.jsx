import { useState } from 'react';
import { Download } from 'lucide-react';
import { api } from '../../../services/api';
import { useAction, useDocumentTitle, useFetch } from '../../../hooks';
import { Button, ErrorState, Skeleton } from '../../../components/common';
import { DataTable, PageHeader, Select, StatCard, TrendChart } from '../../../components/admin/kit';
import { RangePicker } from './Dashboard';
import { formatINR } from '../../../utils';

export default function Reports() {
  useDocumentTitle('Reports');
  const [f, setF] = useState({ range: '30d' });
  const [groupBy, setGroupBy] = useState('day');
  const ready = f.range !== 'custom' || (f.from && f.to);
  const q = { ...f, groupBy };
  const summary = useFetch('/admin/reports/summary', f, { enabled: !!ready });
  const sales = useFetch('/admin/reports/sales', q, { enabled: !!ready });
  const products = useFetch('/admin/reports/products', f, { enabled: !!ready });
  const breakdown = useFetch('/admin/reports/breakdown', f, { enabled: !!ready });
  const [run, busy] = useAction();
  const s = summary.data;

  const exportCsv = (kind) => run(async () => {
    const r = await api.get(`/admin/reports/${kind}`, { params: { ...q, format: 'csv' }, responseType: 'blob' });
    const url = URL.createObjectURL(r.data);
    const a = Object.assign(document.createElement('a'), { href: url, download: `aran-${kind}-${f.range}.csv` });
    a.click(); URL.revokeObjectURL(url);
  });

  return (
    <>
      <PageHeader title="Reports" subtitle="Gross order value, discounts, refunds and net collected revenue are reported separately" actions={<><RangePicker value={f} onChange={setF} /><Select label="Group by" value={groupBy} onChange={setGroupBy} options={[['day', 'Daily'], ['week', 'Weekly'], ['month', 'Monthly']]} /></>} />
      {summary.error ? <ErrorState message={summary.error} onRetry={summary.reload} /> : !s ? <Skeleton className="h-28" /> : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
          <StatCard label="Gross order value" value={formatINR(s.grossPaise)} /><StatCard label="Discounts" value={formatINR(s.discountPaise)} /><StatCard label="Refunds" value={formatINR(s.refundsPaise)} tone="text-bad" />
          <StatCard label="Net order value" value={formatINR(s.netOrderValuePaise)} /><StatCard label="Net collected" value={formatINR(s.netCollectedPaise)} sub="Online paid + COD cash − refunds" tone="text-ok" /><StatCard label="Avg. order value" value={formatINR(s.averageOrderValuePaise)} />
        </div>
      )}
      <section className="card mt-6 p-5"><div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Sales</h2><Button size="sm" variant="outline" loading={busy} onClick={() => exportCsv('sales')}><Download className="size-4" />CSV</Button></div>
        <TrendChart data={(sales.data || []).map((r) => ({ label: r._id, value: r.netPaise, secondary: r.orders }))} />
        {sales.data?.length > 0 && <div className="mt-4"><DataTable rowKey="_id" rows={sales.data} columns={[{ key: '_id', label: 'Period' }, { key: 'orders', label: 'Orders' }, { key: 'g', label: 'Gross', render: (r) => formatINR(r.grossPaise) }, { key: 'd', label: 'Discounts', render: (r) => formatINR(r.discountPaise) }, { key: 'r', label: 'Refunds', render: (r) => formatINR(r.refundsPaise) }, { key: 'n', label: 'Net', render: (r) => <strong>{formatINR(r.netPaise)}</strong> }]} /></div>}
      </section>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section><div className="mb-2 flex items-center justify-between"><h2 className="font-bold">Product performance</h2><Button size="sm" variant="outline" onClick={() => exportCsv('products')}><Download className="size-4" />CSV</Button></div>
          <DataTable rows={products.data} loading={products.loading} error={products.error} rowKey="_id" empty="No sales in this period" columns={[{ key: 'name', label: 'Product' }, { key: 'quantity', label: 'Sold' }, { key: 'r', label: 'Revenue', render: (r) => formatINR(r.revenuePaise) }]} /></section>
        <section><div className="mb-2 flex items-center justify-between"><h2 className="font-bold">Breakdowns</h2><Button size="sm" variant="outline" onClick={() => exportCsv('breakdown')}><Download className="size-4" />CSV</Button></div>
          {breakdown.data && <div className="space-y-4">
            <DataTable rowKey="_id" rows={breakdown.data.payment} empty="No payments" columns={[{ key: '_id', label: 'Payment method', render: (r) => (r._id === 'cod' ? 'Cash on delivery' : 'Online') }, { key: 'orders', label: 'Orders' }, { key: 't', label: 'Value', render: (r) => formatINR(r.totalPaise) }]} />
            <DataTable rowKey="_id" rows={breakdown.data.fulfillment} empty="No orders" columns={[{ key: '_id', label: 'Fulfilment', render: (r) => <span className="capitalize">{r._id}</span> }, { key: 'orders', label: 'Orders' }, { key: 't', label: 'Value', render: (r) => formatINR(r.totalPaise) }]} />
            <DataTable rowKey="_id" rows={breakdown.data.cancellations.map((c) => ({ ...c, _id: c._id || 'No reason' }))} empty="No cancellations" columns={[{ key: '_id', label: 'Cancellation reason' }, { key: 'count', label: 'Count' }]} />
          </div>}</section>
      </div>
    </>
  );
}
