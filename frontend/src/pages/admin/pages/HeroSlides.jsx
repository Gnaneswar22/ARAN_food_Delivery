import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { del, post, put } from '../../../services/api';
import { useAction, useDocumentTitle, useFetch } from '../../../hooks';
import { Badge, Button, Checkbox, ConfirmModal, Field, Modal } from '../../../components/common';
import { DataTable, ImageUpload, PageHeader } from '../../../components/admin/kit';

function SlideForm({ slide, products, onClose, onSaved }) {
  const [image, setImage] = useState(slide?.image || null);
  const [imgErr, setImgErr] = useState('');
  const [run, busy] = useAction();
  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues: { title: slide?.title || '', subtitle: slide?.subtitle || '', tag: slide?.tag || '', ctaLabel: slide?.ctaLabel || 'Order now', productId: slide?.productId?._id || '', isActive: slide?.isActive ?? true } });
  const submit = (v) => {
    if (!image) return setImgErr('Add an image');
    return run(async () => {
      const body = { ...v, productId: v.productId || null, image };
      if (slide) await put(`/admin/hero-slides/${slide._id}`, body); else await post('/admin/hero-slides', body);
      onSaved();
    }, 'Hero item saved');
  };
  return (
    <Modal open onClose={onClose} wide title={slide ? 'Edit hero item' : 'New hero item'}>
      <form className="space-y-4" onSubmit={handleSubmit(submit)}>
        <ImageUpload label="Photo (landscape 3:2 works best)" folder="products" value={image} onChange={(v) => { setImage(v); setImgErr(''); }} />
        {imgErr && <p role="alert" className="text-xs text-bad">{imgErr}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Title" error={errors.title?.message} {...register('title', { required: 'Required', maxLength: 80 })} />
          <Field label="Badge (optional)" placeholder="New, Bestseller…" {...register('tag')} />
          <Field className="sm:col-span-2" label="Short description" {...register('subtitle')} />
          <Field as="select" label="Linked menu item (optional)" hint="Shows its live price and sends the button to its page" {...register('productId')}><option value="">None — button opens the menu</option>{products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</Field>
          <Field label="Button label" {...register('ctaLabel')} />
        </div>
        <Checkbox label="Show on homepage" {...register('isActive')} />
        <div className="flex justify-end gap-2 border-t border-sand pt-4"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Save</Button></div>
      </form>
    </Modal>
  );
}

export default function HeroSlides() {
  useDocumentTitle('Homepage hero');
  const { data, loading, error, reload } = useFetch('/admin/hero-slides');
  const products = useFetch('/admin/products', { limit: 100 });
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [run, busy] = useAction();
  const move = (i, d) => { const ids = data.map((s) => s._id); [ids[i], ids[i + d]] = [ids[i + d], ids[i]]; run(() => post('/admin/hero-slides/reorder', { ids }).then(reload)); };
  return (
    <>
      <PageHeader title="Homepage hero" subtitle="These items change as visitors scroll the top of the homepage, in this order." actions={<Button onClick={() => setEditing({})}><Plus className="size-4" />Add item</Button>} />
      <DataTable rows={data} loading={loading} error={error} onRetry={reload} empty="No hero items — the homepage shows a simple headline instead" columns={[
        { key: 'img', label: '', render: (s) => <img src={s.image.url} alt="" className="h-14 w-20 rounded-lg object-cover" /> },
        { key: 'title', label: 'Item', render: (s) => <span><strong>{s.title}</strong><span className="block max-w-xs truncate text-xs text-muted">{s.subtitle}</span></span> },
        { key: 'link', label: 'Links to', render: (s) => s.productId?.name || <span className="text-muted">Menu</span> },
        { key: 'st', label: 'Status', render: (s) => <Badge tone={s.isActive ? 'green' : 'gray'}>{s.isActive ? 'Visible' : 'Hidden'}</Badge> },
        { key: 'o', label: 'Order', render: (s) => { const i = data.indexOf(s); return <span className="flex gap-1"><button aria-label="Move earlier" disabled={i === 0} onClick={() => move(i, -1)} className="grid size-8 place-items-center rounded-lg border border-sand disabled:opacity-30"><ArrowUp className="size-4" /></button><button aria-label="Move later" disabled={i === data.length - 1} onClick={() => move(i, 1)} className="grid size-8 place-items-center rounded-lg border border-sand disabled:opacity-30"><ArrowDown className="size-4" /></button></span>; } },
        { key: 'a', label: '', className: 'text-right', render: (s) => <span className="flex justify-end gap-1"><Button size="sm" variant="outline" onClick={() => setEditing(s)}>Edit</Button><Button size="sm" variant="ghost" aria-label="Delete" onClick={() => setRemoving(s)}><Trash2 className="size-4" /></Button></span> },
      ]} />
      {editing && <SlideForm slide={editing._id ? editing : null} products={products.data || []} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      <ConfirmModal open={!!removing} onClose={() => setRemoving(null)} loading={busy} danger title="Delete hero item?" confirmLabel="Delete" text={`"${removing?.title}" will be removed from the homepage. Use "Hidden" in Edit if you only want to pause it.`} onConfirm={async () => { await run(() => del(`/admin/hero-slides/${removing._id}`), 'Hero item deleted'); setRemoving(null); reload(); }} />
    </>
  );
}
