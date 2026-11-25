import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Archive, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { del, patch, post, put } from '../../../services/api';
import { useAction, useDebounced, useDocumentTitle, useFetch } from '../../../hooks';
import { Badge, Button, Checkbox, ConfirmModal, Field, Modal, Pagination, ProductImage } from '../../../components/common';
import { DataTable, ImageUpload, PageHeader, Select } from '../../../components/admin/kit';
import { formatINR, toPaise, toRupees } from '../../../utils';

const schema = z.object({
  name: z.string().trim().min(2, 'Required'), description: z.string().max(1500).optional(), categoryId: z.string().min(1, 'Choose a category'),
  price: z.coerce.number().min(0, 'Invalid'), compareAtPrice: z.coerce.number().min(0).optional().or(z.literal('')),
  foodType: z.enum(['veg', 'non-veg', 'egg']), ingredients: z.string().optional(), allergens: z.string().optional(), portionSize: z.string().optional(),
  preparationTime: z.coerce.number().int().min(0).max(240), isAvailable: z.boolean(), isFeatured: z.boolean(), stockManaged: z.boolean(),
  customizations: z.array(z.object({ name: z.string().min(1, 'Name required'), required: z.boolean(), maxSelect: z.coerce.number().int().min(1), choices: z.string().min(1, 'Add at least one choice') })),
});
const csv = (s) => (s || '').split(',').map((x) => x.trim()).filter(Boolean);
// choices typed as "Label:price, Label2:price" (price in rupees, optional)
const parseChoices = (s) => csv(s).map((c) => { const [label, price] = c.split(':'); return { label: label.trim(), pricePaise: toPaise(price) }; });
const fmtChoices = (cs) => cs.map((c) => (c.pricePaise ? `${c.label}:${toRupees(c.pricePaise)}` : c.label)).join(', ');

function ProductForm({ product, categories, onClose, onSaved }) {
  const [images, setImages] = useState(product?.images || []);
  const [run, busy] = useAction();
  const { register, handleSubmit, control, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: product ? { name: product.name, description: product.description, categoryId: product.categoryId?._id || product.categoryId, price: toRupees(product.pricePaise), compareAtPrice: product.compareAtPricePaise ? toRupees(product.compareAtPricePaise) : '', foodType: product.foodType, ingredients: product.ingredients?.join(', '), allergens: product.allergens?.join(', '), portionSize: product.portionSize, preparationTime: product.preparationTime, isAvailable: product.isAvailable, isFeatured: product.isFeatured, stockManaged: product.stockManaged, customizations: product.customizations.map((g) => ({ name: g.name, required: g.required, maxSelect: g.maxSelect, choices: fmtChoices(g.choices) })) }
      : { name: '', description: '', categoryId: categories[0]?._id || '', price: 0, compareAtPrice: '', foodType: 'veg', ingredients: '', allergens: '', portionSize: '', preparationTime: 15, isAvailable: true, isFeatured: false, stockManaged: false, customizations: [] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'customizations' });
  const submit = (v) => run(async () => {
    const body = { name: v.name, description: v.description, categoryId: v.categoryId, images, pricePaise: toPaise(v.price), compareAtPricePaise: v.compareAtPrice === '' || !v.compareAtPrice ? undefined : toPaise(v.compareAtPrice), foodType: v.foodType, ingredients: csv(v.ingredients), allergens: csv(v.allergens), portionSize: v.portionSize, preparationTime: v.preparationTime, isAvailable: v.isAvailable, isFeatured: v.isFeatured, stockManaged: v.stockManaged, customizations: v.customizations.map((g) => ({ ...g, choices: parseChoices(g.choices) })) };
    if (product) await put(`/admin/products/${product._id}`, body); else await post('/admin/products', body);
    onSaved();
  }, 'Product saved');
  return (
    <Modal open onClose={onClose} wide title={product ? 'Edit product' : 'New product'}>
      <form onSubmit={handleSubmit(submit)} className="space-y-4">
        <ImageUpload label="Images (first is the main image)" multiple value={images} onChange={setImages} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" error={errors.name?.message} {...register('name')} />
          <Field as="select" label="Category" error={errors.categoryId?.message} {...register('categoryId')}>{categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</Field>
          <Field label="Price (₹)" type="number" step="0.01" min="0" error={errors.price?.message} {...register('price')} />
          <Field label="Original price (₹, optional)" type="number" step="0.01" min="0" {...register('compareAtPrice')} />
          <Field as="select" label="Food type" {...register('foodType')}><option value="veg">Veg</option><option value="non-veg">Non-veg</option><option value="egg">Egg</option></Field>
          <Field label="Preparation time (min)" type="number" min="0" {...register('preparationTime')} />
          <Field label="Portion size" placeholder="e.g. Serves 1 · 250g" {...register('portionSize')} />
          <Field label="Allergens (comma separated)" hint="Only list what you have verified" {...register('allergens')} />
        </div>
        <Field as="textarea" rows={3} label="Description" {...register('description')} />
        <Field label="Ingredients (comma separated)" {...register('ingredients')} />
        <div className="flex flex-wrap gap-x-6 gap-y-2"><Checkbox label="Available to order" {...register('isAvailable')} /><Checkbox label="Featured on homepage" {...register('isFeatured')} /><Checkbox label="Track stock (manage in Inventory)" {...register('stockManaged')} /></div>
        <div>
          <div className="mb-2 flex items-center justify-between"><span className="label !mb-0">Customization options</span><Button type="button" size="sm" variant="outline" onClick={() => append({ name: '', required: false, maxSelect: 1, choices: '' })}><Plus className="size-4" />Add group</Button></div>
          {fields.map((f, i) => (
            <div key={f.id} className="mb-3 grid gap-3 rounded-xl border border-sand p-3 sm:grid-cols-[1fr_90px_auto]">
              <Field label="Group name" placeholder="Size, Add-ons…" error={errors.customizations?.[i]?.name?.message} {...register(`customizations.${i}.name`)} />
              <Field label="Max picks" type="number" min="1" {...register(`customizations.${i}.maxSelect`)} />
              <div className="flex items-end gap-2"><Checkbox label="Required" {...register(`customizations.${i}.required`)} /><button type="button" onClick={() => remove(i)} aria-label="Remove group" className="grid size-10 place-items-center text-bad"><Trash2 className="size-4" /></button></div>
              <Field className="sm:col-span-3" label="Choices — Label:extra ₹ (comma separated)" placeholder="Regular, Large:40, Extra cheese:25" error={errors.customizations?.[i]?.choices?.message} {...register(`customizations.${i}.choices`)} />
            </div>))}
        </div>
        <div className="flex justify-end gap-2 border-t border-sand pt-4"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Save product</Button></div>
      </form>
    </Modal>
  );
}

export default function Products() {
  useDocumentTitle('Products');
  const [q, setQ] = useState('');
  const [archived, setArchived] = useState('false');
  const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const { data, meta, loading, error, reload } = useFetch('/admin/products', { q: dq, archived, page, limit: 15 });
  const cats = useFetch('/admin/categories');
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [run, busy] = useAction();
  useEffect(() => setPage(1), [dq, archived]);
  return (
    <>
      <PageHeader title="Products" subtitle="Menu items, pricing and availability" actions={<Button onClick={() => setEditing({})} disabled={!cats.data?.length}><Plus className="size-4" />Add product</Button>} />
      {cats.data && !cats.data.length && <p className="mb-4 rounded-xl bg-brand/10 p-3 text-sm">Create a category first, then add products.</p>}
      <div className="mb-4 flex flex-wrap gap-2"><input className="field !w-64" placeholder="Search products" aria-label="Search products" value={q} onChange={(e) => setQ(e.target.value)} /><Select label="Show" value={archived} onChange={setArchived} options={[['false', 'Active'], ['true', 'Archived']]} /></div>
      <DataTable rows={data} loading={loading} error={error} onRetry={reload} empty="No products found" columns={[
        { key: 'img', label: '', render: (p) => <ProductImage src={p.images?.[0]?.url} alt={p.name} zoom={false} className="size-12 rounded-lg" /> },
        { key: 'name', label: 'Product', render: (p) => <span><strong>{p.name}</strong><span className="block text-xs text-muted">{p.categoryId?.name} · {p.foodType}</span></span> },
        { key: 'price', label: 'Price', render: (p) => formatINR(p.pricePaise) },
        { key: 'st', label: 'Status', render: (p) => <span className="flex flex-wrap gap-1">{p.isFeatured && <Badge tone="orange">Featured</Badge>}<Badge tone={p.available ? 'green' : 'red'}>{p.available ? 'Available' : p.inStock ? 'Hidden' : 'Out of stock'}</Badge>{p.stockManaged && <Badge>{p.stockLeft} in stock</Badge>}</span> },
        { key: 'a', label: '', className: 'text-right', render: (p) => (
          <span className="flex justify-end gap-1 whitespace-nowrap">
            {archived === 'false' ? <><Button size="sm" variant="outline" onClick={() => run(() => patch(`/admin/products/${p._id}/availability`, { isAvailable: !p.isAvailable }).then(reload))}>{p.isAvailable ? 'Disable' : 'Enable'}</Button><Button size="sm" variant="outline" onClick={() => setEditing(p)}>Edit</Button><Button size="sm" variant="ghost" aria-label="Archive" onClick={() => setConfirm(p)}><Archive className="size-4" /></Button></>
              : <Button size="sm" variant="outline" onClick={() => run(() => post(`/admin/products/${p._id}/restore`).then(reload), 'Product restored')}><RotateCcw className="size-4" />Restore</Button>}
          </span>) },
      ]} />
      <Pagination meta={meta} onPage={setPage} />
      {editing && <ProductForm product={editing._id ? editing : null} categories={cats.data || []} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      <ConfirmModal open={!!confirm} onClose={() => setConfirm(null)} loading={busy} danger title="Archive product?" confirmLabel="Archive" text={`"${confirm?.name}" will be hidden from the menu. Past orders keep their details and you can restore it later.`} onConfirm={async () => { await run(() => del(`/admin/products/${confirm._id}`), 'Product archived'); setConfirm(null); reload(); }} />
    </>
  );
}
