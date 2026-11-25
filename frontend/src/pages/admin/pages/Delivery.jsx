import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Plus } from 'lucide-react';
import { post, put } from '../../../services/api';
import { useAction, useFetch } from '../../../hooks';
import { Badge, Button, Checkbox, Field, Modal } from '../../../components/common';
import { DataTable } from '../../../components/admin/kit';
import Orders from './Orders';

function PartnerForm({ partner, onClose, onSaved }) {
  const [run, busy] = useAction();
  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues: { name: partner?.name || '', phone: partner?.phone || '', vehicle: partner?.vehicle || '', isActive: partner?.isActive ?? true } });
  return (
    <Modal open onClose={onClose} title={partner ? 'Edit delivery partner' : 'Add delivery partner'}>
      <form className="space-y-3" onSubmit={handleSubmit((v) => run(async () => { partner ? await put(`/admin/delivery/partners/${partner._id}`, v) : await post('/admin/delivery/partners', v); onSaved(); }, 'Saved'))}>
        <Field label="Name" error={errors.name?.message} {...register('name', { required: 'Required' })} />
        <Field label="Mobile number" inputMode="numeric" maxLength={10} error={errors.phone?.message} {...register('phone', { required: 'Required', pattern: { value: /^[6-9]\d{9}$/, message: '10-digit mobile number' } })} />
        <Field label="Vehicle (optional)" {...register('vehicle')} />
        <Checkbox label="Active" {...register('isActive')} />
        {!partner && <p className="rounded-lg bg-cream p-3 text-xs text-muted">The rider signs in at <strong>/delivery</strong> with this mobile number (OTP). They only see orders you assign to them.</p>}
        <Button type="submit" className="w-full" loading={busy}>Save</Button>
      </form>
    </Modal>
  );
}

export default function Delivery() {
  const partners = useFetch('/admin/delivery/partners');
  const [edit, setEdit] = useState(null);
  const [history, setHistory] = useState(false);
  return (
    <>
      <Orders key={String(history)} title="Delivery" subtitle="Assign partners and track delivery orders" fixed={{ orderType: 'delivery', ...(history ? { status: 'delivered' } : {}) }} />
      <div className="mt-2 flex gap-2"><Button size="sm" variant={history ? 'outline' : 'dark'} onClick={() => setHistory(false)}>All delivery orders</Button><Button size="sm" variant={history ? 'dark' : 'outline'} onClick={() => setHistory(true)}>Delivery history (delivered)</Button></div>
      <div className="mb-3 mt-10 flex items-center justify-between"><h2 className="text-lg font-bold">Delivery partners</h2><Button size="sm" onClick={() => setEdit({})}><Plus className="size-4" />Add partner</Button></div>
      <DataTable rows={partners.data} loading={partners.loading} error={partners.error} onRetry={partners.reload} empty="No delivery partners yet — add one to start assigning orders" columns={[
        { key: 'n', label: 'Name', render: (p) => <strong>{p.name}</strong> }, { key: 'p', label: 'Phone', render: (p) => <a className="text-brand" href={`tel:${p.phone}`}>{p.phone}</a> }, { key: 'v', label: 'Vehicle', render: (p) => p.vehicle || '—' },
        { key: 's', label: 'Status', render: (p) => <Badge tone={p.isActive ? 'green' : 'gray'}>{p.isActive ? 'Active' : 'Inactive'}</Badge> }, { key: 'a', label: '', className: 'text-right', render: (p) => <Button size="sm" variant="outline" onClick={() => setEdit(p)}>Edit</Button> },
      ]} />
      {edit && <PartnerForm partner={edit._id ? edit : null} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); partners.reload(); }} />}
    </>
  );
}
