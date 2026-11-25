import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Plus } from 'lucide-react';
import { del, post } from '../../../services/api';
import { useAction, useDocumentTitle, useFetch } from '../../../hooks';
import { Badge, Button, Field, Modal } from '../../../components/common';
import { DataTable, PageHeader } from '../../../components/admin/kit';
import { fmtDate, formatINR, toPaise } from '../../../utils';

function CouponForm({ onClose, onSaved }) {
  const [run, busy] = useAction();
  const { register, handleSubmit, watch, formState: { errors } } = useForm({ defaultValues: { code: '', discountType: 'percentage', value: 10, minOrder: 0, maxDiscount: '', startsAt: '', expiresAt: '', usageLimit: '', perCustomerLimit: '' } });
  const pct = watch('discountType') === 'percentage';
  const num = (v) => (v === '' || v == null ? undefined : Number(v));
  const submit = (v) => run(async () => {
    await post('/admin/coupons', { code: v.code, description: v.description || undefined, discountType: v.discountType, value: pct ? Number(v.value) : toPaise(v.value), minOrderPaise: toPaise(v.minOrder), maxDiscountPaise: v.maxDiscount === '' ? undefined : toPaise(v.maxDiscount), startsAt: v.startsAt || undefined, expiresAt: v.expiresAt || undefined, usageLimit: num(v.usageLimit), perCustomerLimit: num(v.perCustomerLimit) });
    onSaved();
  }, 'Coupon created');
  return (
    <Modal open onClose={onClose} wide title="New coupon">
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleSubmit(submit)}>
        <Field label="Code" className="uppercase" error={errors.code?.message} {...register('code', { required: 'Required', minLength: { value: 3, message: 'Min 3 characters' } })} />
        <Field label="Description" {...register('description')} />
        <Field as="select" label="Discount type" {...register('discountType')}><option value="percentage">Percentage</option><option value="fixed">Fixed amount (₹)</option></Field>
        <Field label={pct ? 'Percent off' : 'Amount off (₹)'} type="number" step="0.01" min="0.01" max={pct ? 100 : undefined} error={errors.value?.message} {...register('value', { required: 'Required', min: { value: 0.01, message: 'Must be positive' }, max: { value: pct ? 100 : 1e6, message: 'Too large' } })} />
        <Field label="Minimum order (₹)" type="number" min="0" {...register('minOrder')} />
        {pct && <Field label="Maximum discount (₹)" type="number" min="0" {...register('maxDiscount')} />}
        <Field label="Starts" type="datetime-local" {...register('startsAt')} /><Field label="Expires" type="datetime-local" {...register('expiresAt')} />
        <Field label="Total usage limit" type="number" min="1" {...register('usageLimit')} /><Field label="Per-customer limit" type="number" min="1" {...register('perCustomerLimit')} />
        <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Create coupon</Button></div>
      </form>
    </Modal>
  );
}

export default function Coupons() {
  useDocumentTitle('Coupons');
  const { data, loading, error, reload } = useFetch('/admin/coupons');
  const [open, setOpen] = useState(false);
  const [run] = useAction();
  const toggle = (c) => run(async () => { const { put } = await import('../../../services/api'); await (c.isActive ? del(`/admin/coupons/${c._id}`) : put(`/admin/coupons/${c._id}`, { isActive: true })); reload(); }, c.isActive ? 'Coupon deactivated' : 'Coupon activated');
  return (
    <>
      <PageHeader title="Coupons" subtitle="All discounts are validated and calculated on the server" actions={<Button onClick={() => setOpen(true)}><Plus className="size-4" />New coupon</Button>} />
      <DataTable rows={data} loading={loading} error={error} onRetry={reload} empty="No coupons yet" columns={[
        { key: 'c', label: 'Code', render: (c) => <strong className="font-mono">{c.code}</strong> },
        { key: 'd', label: 'Discount', render: (c) => (c.discountType === 'percentage' ? `${c.value}%${c.maxDiscountPaise ? ` (max ${formatINR(c.maxDiscountPaise)})` : ''}` : formatINR(c.value)) },
        { key: 'm', label: 'Min order', render: (c) => formatINR(c.minOrderPaise) },
        { key: 'u', label: 'Used', render: (c) => `${c.usedCount}${c.usageLimit ? ` / ${c.usageLimit}` : ''}` },
        { key: 'v', label: 'Valid', render: (c) => <span className="whitespace-nowrap text-muted">{c.startsAt ? fmtDate(c.startsAt, { dateStyle: 'medium' }) : 'Now'} → {c.expiresAt ? fmtDate(c.expiresAt, { dateStyle: 'medium' }) : 'No expiry'}</span> },
        { key: 's', label: 'Status', render: (c) => <Badge tone={c.isActive && (!c.expiresAt || new Date(c.expiresAt) > new Date()) ? 'green' : 'gray'}>{!c.isActive ? 'Inactive' : c.expiresAt && new Date(c.expiresAt) < new Date() ? 'Expired' : 'Active'}</Badge> },
        { key: 'a', label: '', className: 'text-right', render: (c) => <Button size="sm" variant="outline" onClick={() => toggle(c)}>{c.isActive ? 'Deactivate' : 'Activate'}</Button> },
      ]} />
      {open && <CouponForm onClose={() => setOpen(false)} onSaved={() => { setOpen(false); reload(); }} />}
    </>
  );
}
