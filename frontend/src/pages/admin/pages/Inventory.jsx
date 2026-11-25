import { useState } from 'react';
import { patch, post, get } from '../../../services/api';
import { useAction, useDocumentTitle, useFetch } from '../../../hooks';
import { Badge, Button, Field, Modal } from '../../../components/common';
import { DataTable, PageHeader } from '../../../components/admin/kit';
import { fmtDate } from '../../../utils';

export default function Inventory() {
  useDocumentTitle('Inventory');
  const { data, loading, error, reload } = useFetch('/admin/inventory');
  const [adj, setAdj] = useState(null); // {product, type}
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [hist, setHist] = useState(null);
  const [run, busy] = useAction();
  const open = (product, type) => { setAdj({ product, type }); setQty(''); setNote(''); };
  return (
    <>
      <PageHeader title="Inventory" subtitle="Stock is reserved when an order is placed, released on cancellation and deducted on delivery/pickup." />
      <p className="mb-4 text-sm text-muted">Only products with “Track stock” enabled appear here. Enable it from the product editor.</p>
      <DataTable rows={data} loading={loading} error={error} onRetry={reload} empty="No stock-tracked products" columns={[
        { key: 'name', label: 'Product', render: (p) => <strong>{p.name}</strong> },
        { key: 'av', label: 'Available', render: (p) => <span className="font-bold tabular-nums">{p.inventory?.availableQuantity ?? 0}</span> },
        { key: 'rs', label: 'Reserved', render: (p) => p.inventory?.reservedQuantity ?? 0 },
        { key: 'th', label: 'Low-stock at', render: (p) => <input type="number" min="0" aria-label="Low stock threshold" defaultValue={p.inventory?.lowStockThreshold ?? 5} className="field !w-20 !py-1.5" onBlur={(e) => Number(e.target.value) !== (p.inventory?.lowStockThreshold ?? 5) && run(() => patch(`/admin/inventory/${p._id}`, { lowStockThreshold: Number(e.target.value) }).then(reload), 'Threshold updated')} /> },
        { key: 'st', label: 'Status', render: (p) => { const a = p.inventory?.availableQuantity ?? 0; return a === 0 ? <Badge tone="red">Out of stock</Badge> : a <= (p.inventory?.lowStockThreshold ?? 5) ? <Badge tone="orange">Low</Badge> : <Badge tone="green">In stock</Badge>; } },
        { key: 'a', label: '', className: 'text-right', render: (p) => <span className="flex justify-end gap-1 whitespace-nowrap"><Button size="sm" onClick={() => open(p, 'add')}>Add</Button><Button size="sm" variant="outline" onClick={() => open(p, 'reduce')}>Reduce</Button><Button size="sm" variant="ghost" onClick={() => get(`/admin/inventory/${p._id}/history`).then((r) => setHist({ p, rows: r.data }))}>History</Button></span> },
      ]} />
      <Modal open={!!adj} onClose={() => setAdj(null)} title={adj ? `${adj.type === 'add' ? 'Add' : 'Reduce'} stock · ${adj.product.name}` : ''}>
        <div className="space-y-3"><Field label="Quantity" type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} /><Field label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Delivery received, wastage…" />
          <Button className="w-full" loading={busy} disabled={!(Number(qty) > 0)} onClick={async () => { const r = await run(() => post('/admin/inventory/adjust', { productId: adj.product._id, type: adj.type, quantity: Number(qty), note: note || undefined }), 'Stock updated'); if (r) { setAdj(null); reload(); } }}>Update stock</Button></div>
      </Modal>
      <Modal open={!!hist} onClose={() => setHist(null)} wide title={`Stock history · ${hist?.p.name || ''}`}>
        {hist?.rows.length ? <table className="w-full text-sm"><thead className="text-left text-xs uppercase text-muted"><tr><th className="py-2">When</th><th>Type</th><th>Qty</th><th>By / note</th></tr></thead><tbody className="divide-y divide-sand/60">{hist.rows.map((r) => <tr key={r._id}><td className="py-2">{fmtDate(r.createdAt)}</td><td className="capitalize">{r.type}</td><td>{r.quantity}</td><td className="text-muted">{r.by?.name || (r.orderId ? 'Order' : '')} {r.note}</td></tr>)}</tbody></table> : <p className="text-sm text-muted">No movements yet.</p>}
      </Modal>
    </>
  );
}
