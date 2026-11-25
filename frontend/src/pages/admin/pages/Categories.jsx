import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ArrowDown, ArrowUp, Plus } from 'lucide-react';
import { post, put } from '../../../services/api';
import { useAction, useDocumentTitle, useFetch } from '../../../hooks';
import { Badge, Button, Checkbox, Field, Modal, ProductImage } from '../../../components/common';
import { DataTable, ImageUpload, PageHeader } from '../../../components/admin/kit';

function CategoryForm({ cat, onClose, onSaved }) {
  const [image, setImage] = useState(cat?.image?.url ? cat.image : null);
  const [run, busy] = useAction();
  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues: { name: cat?.name || '', description: cat?.description || '', isActive: cat?.isActive ?? true } });
  return (
    <Modal open onClose={onClose} title={cat ? 'Edit category' : 'New category'}>
      <form className="space-y-4" onSubmit={handleSubmit((v) => run(async () => { const body = { ...v, ...(image ? { image } : {}) }; if (cat) await put(`/admin/categories/${cat._id}`, body); else await post('/admin/categories', body); onSaved(); }, 'Category saved'))}>
        <ImageUpload folder="categories" value={image} onChange={setImage} label="Category image" />
        <Field label="Name" error={errors.name?.message} {...register('name', { required: 'Name is required', minLength: { value: 2, message: 'Too short' } })} />
        <Field label="Short description" {...register('description')} />
        <Checkbox label="Active (visible to customers)" {...register('isActive')} />
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Save</Button></div>
      </form>
    </Modal>
  );
}

export default function Categories() {
  useDocumentTitle('Categories');
  const { data, loading, error, reload } = useFetch('/admin/categories');
  const [editing, setEditing] = useState(null);
  const [run] = useAction();
  const move = (i, d) => { const ids = data.map((c) => c._id); [ids[i], ids[i + d]] = [ids[i + d], ids[i]]; run(() => post('/admin/categories/reorder', { ids }).then(reload)); };
  return (
    <>
      <PageHeader title="Categories" subtitle="Organise the menu and set display order" actions={<Button onClick={() => setEditing({})}><Plus className="size-4" />Add category</Button>} />
      <DataTable rows={data} loading={loading} error={error} onRetry={reload} empty="No categories yet" columns={[
        { key: 'img', label: '', render: (c) => <ProductImage src={c.image?.url} alt={c.name} zoom={false} className="size-12 rounded-lg" /> },
        { key: 'name', label: 'Category', render: (c) => <span><strong>{c.name}</strong><span className="block text-xs text-muted">{c.description}</span></span> },
        { key: 's', label: 'Status', render: (c) => <Badge tone={c.isActive ? 'green' : 'gray'}>{c.isActive ? 'Active' : 'Hidden'}</Badge> },
        { key: 'o', label: 'Order', render: (c) => { const i = data.indexOf(c); return <span className="flex gap-1"><button aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="grid size-8 place-items-center rounded-lg border border-sand disabled:opacity-30"><ArrowUp className="size-4" /></button><button aria-label="Move down" disabled={i === data.length - 1} onClick={() => move(i, 1)} className="grid size-8 place-items-center rounded-lg border border-sand disabled:opacity-30"><ArrowDown className="size-4" /></button></span>; } },
        { key: 'a', label: '', className: 'text-right', render: (c) => <Button size="sm" variant="outline" onClick={() => setEditing(c)}>Edit</Button> },
      ]} />
      {editing && <CategoryForm cat={editing._id ? editing : null} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </>
  );
}
