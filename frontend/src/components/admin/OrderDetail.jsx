import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { get, post } from '../../services/api';
import { useAction } from '../../hooks';
import { Badge, Button, Field, Modal, Spinner } from '../common';
import { NEXT_STATUS, STATUS_LABEL, fmtDate, formatINR } from '../../utils';

export const statusTone = (s) => (s === 'cancelled' ? 'red' : ['delivered', 'picked_up'].includes(s) ? 'green' : s === 'placed' ? 'dark' : 'orange');
export const payTone = (s) => (s === 'paid' ? 'green' : ['failed', 'refunded'].includes(s) ? 'red' : 'gray');

export default function OrderDetail({ orderId, onClose, onChanged }) {
  const [o, setO] = useState(null);
  const [partners, setPartners] = useState([]);
  const [reason, setReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [run, busy] = useAction();
  const load = () => get(`/admin/orders/${orderId}`).then((r) => setO(r.data));
  useEffect(() => { if (orderId) { setO(null); setCancelling(false); load(); get('/admin/delivery/partners').then((r) => setPartners(r.data.filter((p) => p.isActive))).catch(() => {}); } }, [orderId]); // eslint-disable-line
  const act = async (fn, msg) => { const r = await run(fn, msg); if (r !== undefined) { await load(); onChanged?.(); } };
  const next = o && NEXT_STATUS(o);
  const closed = o && ['delivered', 'picked_up', 'cancelled'].includes(o.orderStatus);
  const s = (status, extra = {}) => post(`/admin/orders/${orderId}/status`, { status, ...extra });
  const collected = o?.codCollection?.reduce((a, c) => a + c.amountPaise, 0) || 0;

  return (
    <Modal open={!!orderId} onClose={onClose} wide title={o ? `Order ${o.orderNumber}` : 'Order'}>
      {!o ? <div className="grid place-items-center py-10"><Spinner className="size-7" /></div> : (
        <div className="space-y-5 text-sm print-area">
          <div className="flex flex-wrap items-center gap-2"><Badge tone={statusTone(o.orderStatus)}>{STATUS_LABEL[o.orderStatus]}</Badge><Badge tone={payTone(o.paymentStatus)}>{o.paymentMethod === 'cod' ? 'COD · ' : 'Online · '}{o.paymentStatus.replace('_', ' ')}</Badge><Badge>{o.orderType}</Badge><span className="ml-auto text-xs text-muted">{fmtDate(o.createdAt)}</span></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><p className="mb-1 font-bold">Customer</p><p>{o.customer?.name}</p><a className="text-brand" href={`tel:${o.customer?.phone}`}>{o.customer?.phone}</a>{o.customer?.email && <p className="text-muted">{o.customer.email}</p>}</div>
            <div><p className="mb-1 font-bold">{o.orderType === 'delivery' ? 'Delivery address' : 'Pickup'}</p>{o.orderType === 'delivery' ? <p>{o.deliveryAddressSnapshot?.line1}{o.deliveryAddressSnapshot?.line2 ? `, ${o.deliveryAddressSnapshot.line2}` : ''}<br />{o.deliveryAddressSnapshot?.city} – {o.deliveryAddressSnapshot?.pincode}{o.deliveryAddressSnapshot?.landmark && <><br />Landmark: {o.deliveryAddressSnapshot.landmark}</>}{o.deliveryInstructions && <><br /><em>“{o.deliveryInstructions}”</em></>}</p> : <p>{o.pickupDetailsSnapshot?.slot || 'ASAP'}</p>}</div>
          </div>
          <table className="w-full"><tbody className="divide-y divide-sand/60">{o.items.map((i, k) => <tr key={k}><td className="py-2"><strong>{i.quantity}×</strong> {i.name}{i.options?.length > 0 && <span className="block text-xs text-muted">{i.options.map((x) => `${x.group}: ${x.label}`).join(', ')}</span>}{i.note && <span className="block text-xs italic text-muted">“{i.note}”</span>}</td><td className="py-2 text-right tabular-nums">{formatINR(i.lineTotalPaise)}</td></tr>)}</tbody></table>
          <div className="space-y-0.5 border-t border-sand pt-3 text-right"><p>Subtotal {formatINR(o.pricingSnapshot.subtotalPaise)}</p>{o.pricingSnapshot.discountPaise > 0 && <p>Discount − {formatINR(o.pricingSnapshot.discountPaise)} {o.pricingSnapshot.couponCode && `(${o.pricingSnapshot.couponCode})`}</p>}<p>Tax {formatINR(o.pricingSnapshot.taxPaise)}</p>{o.orderType === 'delivery' && <p>Delivery {formatINR(o.pricingSnapshot.deliveryFeePaise)}</p>}<p className="text-base font-extrabold">Total {formatINR(o.pricingSnapshot.totalPaise)}</p>{o.refundedPaise > 0 && <p className="text-bad">Refunded {formatINR(o.refundedPaise)}</p>}</div>

          {o.orderType === 'delivery' && !closed && (
            <div className="flex items-end gap-2"><Field as="select" label="Delivery partner" className="flex-1" value={o.deliveryPartnerId?._id || ''} onChange={(e) => e.target.value && act(() => post(`/admin/orders/${orderId}/assign`, { partnerId: e.target.value }), 'Partner assigned')}><option value="">Unassigned</option>{partners.map((p) => <option key={p._id} value={p._id}>{p.name} · {p.phone}</option>)}</Field><Button variant="outline" loading={busy} onClick={() => act(() => post(`/admin/orders/${orderId}/auto-assign`), 'Rider assigned')}>Auto-assign</Button></div>
          )}
          {o.orderType === 'delivery' && closed && o.deliveryPartnerId && <p>Delivered by <strong>{o.deliveryPartnerId.name}</strong> ({o.deliveryPartnerId.phone})</p>}

          {o.paymentMethod === 'cod' && o.orderStatus !== 'cancelled' && (
            <div className="rounded-xl bg-cream p-3"><p className="font-bold">Cash collection</p>{o.codCollection.map((c, i) => <p key={i} className="text-xs text-muted">{formatINR(c.amountPaise)} · {fmtDate(c.at)}</p>)}{collected < o.pricingSnapshot.totalPaise ? <Button size="sm" className="mt-2" loading={busy} onClick={() => act(() => post(`/admin/orders/${orderId}/cod-collect`, {}), 'Cash recorded')}>Record {formatINR(o.pricingSnapshot.totalPaise - collected)} received</Button> : <p className="mt-1 text-ok">Fully collected</p>}</div>
          )}

          {cancelling && <div className="space-y-2 rounded-xl border border-bad/30 bg-bad/5 p-3"><Field label="Cancellation reason (shown to customer)" value={reason} onChange={(e) => setReason(e.target.value)} /><div className="flex gap-2"><Button variant="danger" size="sm" loading={busy} disabled={reason.trim().length < 3} onClick={() => act(() => s('cancelled', { reason }), 'Order cancelled')}>Confirm cancel</Button><Button variant="ghost" size="sm" onClick={() => setCancelling(false)}>Back</Button></div></div>}

          <div className="flex flex-wrap gap-2 border-t border-sand pt-4 print:hidden">
            {o.orderStatus === 'placed' && <Button loading={busy} onClick={() => act(() => s('confirmed'), 'Order accepted')}>Accept order</Button>}
            {next && o.orderStatus !== 'placed' && <Button loading={busy} onClick={() => act(() => s(next), `Marked ${STATUS_LABEL[next]}`)}>Mark {STATUS_LABEL[next].toLowerCase()}</Button>}
            {!closed && !cancelling && <Button variant="outline" onClick={() => setCancelling(true)}>Reject / cancel</Button>}
            {o.paymentMethod === 'online' && ['paid', 'partially_refunded'].includes(o.paymentStatus) && o.orderStatus !== 'cancelled' && <Button variant="outline" loading={busy} onClick={() => confirm('Refund the full remaining amount?') && act(() => post(`/admin/orders/${orderId}/refund`, { reason: 'Admin refund' }), 'Refund initiated')}>Refund</Button>}
            <Button variant="ghost" className="ml-auto" onClick={() => window.print()}><Printer className="size-4" />Print receipt</Button>
          </div>
          <details className="print:hidden"><summary className="cursor-pointer text-xs font-semibold text-muted">Status history</summary><ul className="mt-2 space-y-1 text-xs text-muted">{o.statusHistory.map((h, i) => <li key={i}>{fmtDate(h.at)} — {STATUS_LABEL[h.status] || h.status}{h.note ? ` · ${h.note}` : ''}</li>)}</ul></details>
        </div>
      )}
    </Modal>
  );
}
