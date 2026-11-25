const { Product, Inventory, Category } = require('../models');
const { escapeRegex, pageParams, ApiError } = require('../utils');

let bestCache = { at: 0, ids: new Set() };
async function bestsellerIds() {
  if (Date.now() - bestCache.at < 60000) return bestCache.ids;
  const top = await Product.find({ isArchived: false, soldCount: { $gt: 0 } }).sort({ soldCount: -1 }).limit(6).select('_id');
  bestCache = { at: Date.now(), ids: new Set(top.map((p) => String(p._id))) };
  return bestCache.ids;
}

async function decorate(products) {
  const ids = products.map((p) => p._id);
  const [invs, best] = await Promise.all([Inventory.find({ productId: { $in: ids } }).lean(), bestsellerIds()]);
  const iMap = new Map(invs.map((i) => [String(i.productId), i]));
  return products.map((p) => {
    const o = p.toObject ? p.toObject() : p;
    const inv = iMap.get(String(o._id));
    const inStock = !o.stockManaged || (inv && inv.isAvailable && inv.availableQuantity > 0);
    return { ...o, inStock: !!inStock, available: o.isAvailable && !!inStock, isBestseller: best.has(String(o._id)), ...(o.stockManaged ? { stockLeft: inv?.availableQuantity ?? 0 } : {}) };
  });
}

async function listProducts(q) {
  const { page, limit, skip } = pageParams(q);
  const f = { isArchived: false };
  if (q.category) {
    const cat = await Category.findOne({ slug: q.category, isActive: true });
    f.categoryId = cat ? cat._id : null;
  }
  if (q.q) f.name = { $regex: escapeRegex(q.q), $options: 'i' };
  if (q.foodType) f.foodType = q.foodType;
  if (q.featured === 'true') f.isFeatured = true;
  if (q.bestseller === 'true') f.soldCount = { $gt: 0 };
  if (q.minPrice || q.maxPrice) f.pricePaise = { ...(q.minPrice ? { $gte: Number(q.minPrice) * 100 } : {}), ...(q.maxPrice ? { $lte: Number(q.maxPrice) * 100 } : {}) };
  const sort = { price_asc: { pricePaise: 1 }, price_desc: { pricePaise: -1 }, popular: { soldCount: -1, createdAt: -1 }, newest: { createdAt: -1 } }[q.sort] || (q.bestseller === 'true' ? { soldCount: -1 } : { isFeatured: -1, createdAt: -1 });
  // hide products from inactive categories
  const activeCats = await Category.find({ isActive: true }).select('_id');
  f.categoryId = f.categoryId === null ? null : { $in: f.categoryId ? [f.categoryId] : activeCats.map((c) => c._id) };
  const [items, total] = await Promise.all([Product.find(f).populate('categoryId', 'name slug').sort(sort).skip(skip).limit(limit), Product.countDocuments(f)]);
  return { items: await decorate(items), meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}

async function getBySlug(slug) {
  const p = await Product.findOne({ slug, isArchived: false }).populate('categoryId', 'name slug');
  if (!p) throw new ApiError(404, 'Product not found');
  const [dec] = await decorate([p]);
  const related = await Product.find({ categoryId: p.categoryId._id, _id: { $ne: p._id }, isArchived: false, isAvailable: true }).limit(4);
  return { ...dec, related: await decorate(related) };
}

module.exports = { listProducts, getBySlug, decorate };
