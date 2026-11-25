const router = require('express').Router();
const {
  HeroSlide, User, Category, Product, Order, Inventory, InventoryTransaction, Coupon, Review, DeliveryPartner, Notification, Payment, AuditLog,
} = require('../models');
const { asyncHandler, ok, ApiError, slugify, pageParams, escapeRegex } = require('../utils');
const { authenticate, adminOnly, managerUp, ownerOnly, validate } = require('../middleware');
const v = require('../validators');
const bcrypt = require('bcryptjs');
const orderSvc = require('../services/order.service');
const paySvc = require('../services/payment.service');
const invSvc = require('../services/inventory.service');
const settingsSvc = require('../services/settings.service');
const reports = require('../services/report.service');
const catalog = require('../services/catalog.service');
const { upload, uploadImage, destroyImage } = require('../integrations/cloudinary');

router.use(authenticate, adminOnly);
const audit = (req, action, entity, entityId, meta) => AuditLog.create({ userId: req.user._id, action, entity, entityId: String(entityId || ''), meta }).catch(() => {});
const page = (items, total, p) => ({ page: p.page, limit: p.limit, total, pages: Math.ceil(total / p.limit) });

// ---- Dashboard & reports
router.get('/dashboard', asyncHandler(async (req, res) => ok(res, await reports.dashboard(req.query))));
router.get('/reports/:kind', managerUp, asyncHandler(async (req, res) => {
  const k = req.params.kind;
  const data = k === 'sales' ? await reports.sales(req.query) : k === 'products' ? await reports.productPerformance(req.query) : k === 'breakdown' ? await reports.breakdown(req.query) : k === 'summary' ? await reports.summary(req.query) : null;
  if (!data) throw new ApiError(404, 'Unknown report');
  if (req.query.format === 'csv') {
    const rows = Array.isArray(data) ? data : Object.entries(data).flatMap(([section, list]) => (Array.isArray(list) ? list.map((r) => ({ section, ...r })) : [{ section, ...list }]));
    const cols = [...new Set(rows.flatMap(Object.keys))];
    res.set({ 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="aran-${k}.csv"` });
    return res.send(reports.toCsv(rows, cols));
  }
  ok(res, data);
}));

// ---- Uploads (Cloudinary)
router.post('/uploads', managerUp, upload.single('image'), asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(422, 'No image provided');
  ok(res, await uploadImage(req.file.buffer, 'aran/' + (req.query.folder === 'categories' ? 'categories' : 'products')), null, 201);
}));

// ---- Orders
router.get('/orders', asyncHandler(async (req, res) => {
  const p = pageParams(req.query);
  const f = {};
  const q = req.query;
  if (q.status) f.orderStatus = q.status;
  if (q.paymentMethod) f.paymentMethod = q.paymentMethod;
  if (q.orderType) f.orderType = q.orderType;
  if (q.search) f.orderNumber = { $regex: escapeRegex(q.search), $options: 'i' };
  if (q.from || q.to) f.createdAt = { ...(q.from ? { $gte: new Date(q.from) } : {}), ...(q.to ? { $lt: new Date(+new Date(q.to) + 864e5) } : {}) };
  if (!q.status) f.orderStatus = { $ne: 'pending_payment' };
  const [items, total] = await Promise.all([Order.find(f).populate('deliveryPartnerId', 'name phone').sort({ createdAt: -1 }).skip(p.skip).limit(p.limit), Order.countDocuments(f)]);
  ok(res, items, page(items, total, p));
}));
router.get('/orders/:id', asyncHandler(async (req, res) => {
  const o = await Order.findById(req.params.id).populate('deliveryPartnerId', 'name phone');
  if (!o) throw new ApiError(404, 'Order not found');
  const payment = await Payment.findOne({ orderId: o._id });
  ok(res, { ...o.toObject(), payment });
}));
router.post('/orders/:id/status', validate(v.statusChange), asyncHandler(async (req, res) => {
  const o = await orderSvc.transition(req.params.id, req.body.status, { by: req.user._id, reason: req.body.reason, note: req.body.note });
  audit(req, `order.${req.body.status}`, 'Order', o._id, { reason: req.body.reason });
  ok(res, o);
}));
router.post('/orders/:id/assign', validate(v.z.object({ partnerId: v.objectId })), asyncHandler(async (req, res) => {
  ok(res, await orderSvc.assignPartner(req.params.id, req.body.partnerId, req.user._id));
}));
router.post('/orders/:id/auto-assign', asyncHandler(async (req, res) => {
  const p = await require('../services/dispatch.service').autoAssign(req.params.id, req.user._id);
  if (!p) throw new ApiError(409, 'No rider is on duty right now, or the order already has one');
  ok(res, { partner: { _id: p._id, name: p.name } });
}));
router.post('/orders/:id/cod-collect', validate(v.z.object({ amountPaise: v.z.number().int().positive().optional(), note: v.z.string().max(200).optional() })), asyncHandler(async (req, res) => {
  const o = await orderSvc.recordCodCollection(req.params.id, req.body, req.user._id);
  audit(req, 'order.cod_collect', 'Order', o._id, req.body);
  ok(res, o);
}));
router.post('/orders/:id/refund', managerUp, validate(v.z.object({ amountPaise: v.z.number().int().positive().optional(), reason: v.z.string().max(200).optional() })), asyncHandler(async (req, res) => {
  const o = await paySvc.refund(req.params.id, req.body);
  audit(req, 'order.refund', 'Order', o._id, req.body);
  ok(res, o);
}));
router.post('/payments/reconcile', managerUp, asyncHandler(async (req, res) => ok(res, await paySvc.reconcile())));

// ---- Categories
router.get('/categories', asyncHandler(async (req, res) => ok(res, await Category.find().sort({ sortOrder: 1, name: 1 }))));
router.post('/categories', managerUp, validate(v.category), asyncHandler(async (req, res) => {
  const c = await Category.create({ ...req.body, slug: slugify(req.body.name) });
  audit(req, 'category.create', 'Category', c._id);
  ok(res, c, null, 201);
}));
router.put('/categories/:id', managerUp, validate(v.category.partial()), asyncHandler(async (req, res) => {
  const c = await Category.findById(req.params.id);
  if (!c) throw new ApiError(404, 'Category not found');
  if (req.body.name) c.slug = slugify(req.body.name);
  if (req.body.image && c.image?.publicId && c.image.publicId !== req.body.image.publicId) destroyImage(c.image.publicId);
  Object.assign(c, req.body);
  await c.save();
  audit(req, 'category.update', 'Category', c._id);
  ok(res, c);
}));
router.post('/categories/reorder', managerUp, validate(v.z.object({ ids: v.z.array(v.objectId) })), asyncHandler(async (req, res) => {
  await Category.bulkWrite(req.body.ids.map((id, i) => ({ updateOne: { filter: { _id: id }, update: { sortOrder: i } } })));
  ok(res, { reordered: true });
}));
router.delete('/categories/:id', managerUp, asyncHandler(async (req, res) => {
  if (await Product.exists({ categoryId: req.params.id, isArchived: false })) throw new ApiError(409, 'Move or archive this category\'s products first, or deactivate it instead');
  await Category.findByIdAndDelete(req.params.id);
  ok(res, { deleted: true });
}));

// ---- Products
router.get('/products', asyncHandler(async (req, res) => {
  const p = pageParams(req.query);
  const f = { isArchived: req.query.archived === 'true' };
  if (req.query.q) f.name = { $regex: escapeRegex(req.query.q), $options: 'i' };
  if (req.query.category) f.categoryId = req.query.category;
  const [items, total] = await Promise.all([Product.find(f).populate('categoryId', 'name').sort({ createdAt: -1 }).skip(p.skip).limit(p.limit), Product.countDocuments(f)]);
  ok(res, await catalog.decorate(items), page(items, total, p));
}));
async function uniqueSlug(name, exceptId) {
  const base = slugify(name) || 'item';
  let slug = base, n = 1;
  while (await Product.exists({ slug, ...(exceptId ? { _id: { $ne: exceptId } } : {}) })) slug = `${base}-${++n}`;
  return slug;
}
router.post('/products', managerUp, validate(v.product), asyncHandler(async (req, res) => {
  if (!(await Category.exists({ _id: req.body.categoryId }))) throw new ApiError(422, 'Category not found');
  const p = await Product.create({ ...req.body, slug: await uniqueSlug(req.body.name) });
  if (p.stockManaged) await Inventory.create({ productId: p._id, availableQuantity: 0 });
  audit(req, 'product.create', 'Product', p._id);
  ok(res, p, null, 201);
}));
router.put('/products/:id', managerUp, validate(v.product.partial()), asyncHandler(async (req, res) => {
  const p = await Product.findById(req.params.id);
  if (!p) throw new ApiError(404, 'Product not found');
  if (req.body.name && req.body.name !== p.name) p.slug = await uniqueSlug(req.body.name, p._id);
  if (req.body.images) {
    const keep = new Set(req.body.images.map((i) => i.publicId));
    p.images.filter((i) => i.publicId && !keep.has(i.publicId)).forEach((i) => destroyImage(i.publicId));
  }
  Object.assign(p, req.body);
  await p.save();
  if (p.stockManaged) await Inventory.updateOne({ productId: p._id }, { $setOnInsert: { availableQuantity: 0 } }, { upsert: true });
  audit(req, 'product.update', 'Product', p._id);
  ok(res, p);
}));
// Products referenced by orders are archived, never hard-deleted.
router.delete('/products/:id', managerUp, asyncHandler(async (req, res) => {
  const p = await Product.findByIdAndUpdate(req.params.id, { isArchived: true, isAvailable: false, isFeatured: false }, { returnDocument: 'after' });
  if (!p) throw new ApiError(404, 'Product not found');
  audit(req, 'product.archive', 'Product', p._id);
  ok(res, p);
}));
router.post('/products/:id/restore', managerUp, asyncHandler(async (req, res) => ok(res, await Product.findByIdAndUpdate(req.params.id, { isArchived: false }, { returnDocument: 'after' }))));
router.patch('/products/:id/availability', validate(v.z.object({ isAvailable: v.z.boolean() })), asyncHandler(async (req, res) => ok(res, await Product.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' }))));

// ---- Homepage hero slides
router.get('/hero-slides', asyncHandler(async (req, res) => ok(res, await HeroSlide.find().sort({ sortOrder: 1, createdAt: 1 }).populate('productId', 'name slug'))));
router.post('/hero-slides', managerUp, validate(v.heroSlide), asyncHandler(async (req, res) => {
  const last = await HeroSlide.findOne().sort({ sortOrder: -1 });
  const s = await HeroSlide.create({ ...req.body, productId: req.body.productId || undefined, sortOrder: (last?.sortOrder ?? -1) + 1 });
  audit(req, 'hero.create', 'HeroSlide', s._id);
  ok(res, s, null, 201);
}));
router.put('/hero-slides/:id', managerUp, validate(v.heroSlide.partial()), asyncHandler(async (req, res) => {
  const s = await HeroSlide.findById(req.params.id);
  if (!s) throw new ApiError(404, 'Slide not found');
  if (req.body.image && s.image?.publicId && s.image.publicId !== req.body.image.publicId) destroyImage(s.image.publicId);
  Object.assign(s, req.body, { productId: req.body.productId === undefined ? s.productId : req.body.productId || undefined });
  await s.save();
  audit(req, 'hero.update', 'HeroSlide', s._id);
  ok(res, s);
}));
router.post('/hero-slides/reorder', managerUp, validate(v.z.object({ ids: v.z.array(v.objectId) })), asyncHandler(async (req, res) => {
  await HeroSlide.bulkWrite(req.body.ids.map((id, i) => ({ updateOne: { filter: { _id: id }, update: { sortOrder: i } } })));
  ok(res, { reordered: true });
}));
router.delete('/hero-slides/:id', managerUp, asyncHandler(async (req, res) => {
  const s = await HeroSlide.findByIdAndDelete(req.params.id);
  if (!s) throw new ApiError(404, 'Slide not found');
  destroyImage(s.image?.publicId);
  audit(req, 'hero.delete', 'HeroSlide', s._id);
  ok(res, { deleted: true });
}));

// ---- Inventory
router.get('/inventory', asyncHandler(async (req, res) => {
  const items = await Product.find({ isArchived: false, stockManaged: true }).select('name images isAvailable').lean();
  const invs = await Inventory.find({ productId: { $in: items.map((i) => i._id) } }).lean();
  const m = new Map(invs.map((i) => [String(i.productId), i]));
  ok(res, items.map((p) => ({ ...p, inventory: m.get(String(p._id)) || null })));
}));
router.post('/inventory/adjust', validate(v.stockAdjust), asyncHandler(async (req, res) => ok(res, await invSvc.adjust({ ...req.body, by: req.user._id }))));
router.patch('/inventory/:productId', validate(v.z.object({ lowStockThreshold: v.z.number().int().min(0).optional(), isAvailable: v.z.boolean().optional() })), asyncHandler(async (req, res) => {
  ok(res, await Inventory.findOneAndUpdate({ productId: req.params.productId }, req.body, { returnDocument: 'after' }));
}));
router.get('/inventory/:productId/history', asyncHandler(async (req, res) => ok(res, await InventoryTransaction.find({ productId: req.params.productId }).sort({ createdAt: -1 }).limit(100).populate('by', 'name'))));

// ---- Customers (PII: manager+)
router.get('/customers', managerUp, asyncHandler(async (req, res) => {
  const p = pageParams(req.query);
  const f = { role: 'customer' };
  if (req.query.q) { const r = { $regex: escapeRegex(req.query.q), $options: 'i' }; f.$or = [{ name: r }, { email: r }, { phone: r }]; }
  const [users, total] = await Promise.all([User.find(f).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).lean(), User.countDocuments(f)]);
  const stats = await Order.aggregate([{ $match: { userId: { $in: users.map((u) => u._id) }, orderStatus: { $in: ['delivered', 'picked_up'] } } }, { $group: { _id: '$userId', orders: { $sum: 1 }, spentPaise: { $sum: '$pricingSnapshot.totalPaise' } } }]);
  const sm = new Map(stats.map((s) => [String(s._id), s]));
  ok(res, users.map((u) => ({ id: u._id, name: u.name, email: u.email, phone: u.phone, isActive: u.isActive, createdAt: u.createdAt, orders: sm.get(String(u._id))?.orders || 0, spentPaise: sm.get(String(u._id))?.spentPaise || 0 })), page(users, total, p));
}));
router.get('/customers/:id', managerUp, asyncHandler(async (req, res) => {
  const [u, orders] = await Promise.all([User.findOne({ _id: req.params.id, role: 'customer' }).lean(), Order.find({ userId: req.params.id }).sort({ createdAt: -1 }).limit(50).select('orderNumber orderStatus pricingSnapshot createdAt orderType')]);
  if (!u) throw new ApiError(404, 'Customer not found');
  ok(res, { id: u._id, name: u.name, email: u.email, phone: u.phone, isActive: u.isActive, orders });
}));
router.patch('/customers/:id/status', managerUp, validate(v.z.object({ isActive: v.z.boolean() })), asyncHandler(async (req, res) => {
  const u = await User.findOneAndUpdate({ _id: req.params.id, role: 'customer' }, req.body, { returnDocument: 'after' });
  if (!u) throw new ApiError(404, 'Customer not found');
  audit(req, 'customer.status', 'User', u._id, req.body);
  ok(res, { id: u._id, isActive: u.isActive });
}));

// ---- Delivery & pickup
router.get('/delivery/partners', asyncHandler(async (req, res) => ok(res, await DeliveryPartner.find().sort({ name: 1 }))));
router.post('/delivery/partners', managerUp, validate(v.partner), asyncHandler(async (req, res) => {
  let user = await User.findOne({ phone: req.body.phone });
  if (user && user.role !== 'delivery') throw new ApiError(409, 'This mobile number already belongs to another account');
  user ||= await User.create({ name: req.body.name, phone: req.body.phone, role: 'delivery', isPhoneVerified: false });
  const p = await DeliveryPartner.create({ ...req.body, userId: user._id });
  audit(req, 'partner.create', 'DeliveryPartner', p._id);
  ok(res, p, null, 201);
}));
router.put('/delivery/partners/:id', managerUp, validate(v.partner.partial()), asyncHandler(async (req, res) => {
  const p = await DeliveryPartner.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' });
  if (!p) throw new ApiError(404, 'Partner not found');
  if (p.userId && typeof req.body.isActive === 'boolean') await User.updateOne({ _id: p.userId }, { isActive: req.body.isActive });
  ok(res, p);
}));
router.get('/delivery/orders', asyncHandler(async (req, res) => {
  const f = { orderType: 'delivery', orderStatus: req.query.history === 'true' ? { $in: ['delivered', 'cancelled'] } : { $in: ['placed', 'confirmed', 'preparing', 'ready', 'out_for_delivery'] } };
  ok(res, await Order.find(f).populate('deliveryPartnerId', 'name phone').sort({ createdAt: -1 }).limit(100));
}));
router.get('/pickup/orders', asyncHandler(async (req, res) => {
  const f = { orderType: 'pickup', orderStatus: req.query.history === 'true' ? { $in: ['picked_up', 'cancelled'] } : { $in: ['placed', 'confirmed', 'preparing', 'ready'] } };
  ok(res, await Order.find(f).sort({ createdAt: -1 }).limit(100));
}));

// ---- Coupons
router.get('/coupons', managerUp, asyncHandler(async (req, res) => ok(res, await Coupon.find().sort({ createdAt: -1 }).select('-usedBy'))));
router.post('/coupons', managerUp, validate(v.coupon), asyncHandler(async (req, res) => { const c = await Coupon.create(req.body); audit(req, 'coupon.create', 'Coupon', c._id); ok(res, c, null, 201); }));
router.put('/coupons/:id', managerUp, validate(v.z.object({ isActive: v.z.boolean().optional(), expiresAt: v.z.coerce.date().optional(), usageLimit: v.z.number().int().positive().optional(), description: v.z.string().optional(), minOrderPaise: v.z.number().int().min(0).optional(), maxDiscountPaise: v.z.number().int().min(0).optional(), perCustomerLimit: v.z.number().int().positive().optional() })), asyncHandler(async (req, res) => {
  ok(res, await Coupon.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' }));
}));
router.delete('/coupons/:id', managerUp, asyncHandler(async (req, res) => { await Coupon.findByIdAndUpdate(req.params.id, { isActive: false }); ok(res, { deactivated: true }); }));

// ---- Reviews moderation
router.get('/reviews', asyncHandler(async (req, res) => ok(res, await Review.find(req.query.status ? { status: req.query.status } : {}).populate('userId', 'name').populate('productId', 'name').sort({ createdAt: -1 }).limit(100))));
router.patch('/reviews/:id', managerUp, validate(v.z.object({ status: v.z.enum(['approved', 'rejected']) })), asyncHandler(async (req, res) => ok(res, await Review.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' }))));

// ---- Settings
router.get('/settings', managerUp, asyncHandler(async (req, res) => { const { payments, sms, ...s } = await settingsSvc.getSettings(true); ok(res, s); }));

// ---- Payment gateway (owner only). Secrets are write-only: stored encrypted, never returned.
router.get('/payment-settings', ownerOnly, asyncHandler(async (req, res) => ok(res, await settingsSvc.getPaymentAdminView())));
router.put('/payment-settings', ownerOnly, validate(v.z.object({
  onlineEnabled: v.z.boolean().optional(), codEnabled: v.z.boolean().optional(),
  razorpay: v.z.object({ keyId: v.z.string().trim().max(80).regex(/^(rzp_(test|live)_[A-Za-z0-9]+)?$/, 'Key ID should look like rzp_live_xxxx or rzp_test_xxxx').optional(), keySecret: v.z.string().max(120).optional(), webhookSecret: v.z.string().max(120).optional(), clearSecrets: v.z.boolean().optional() }).optional(),
})), asyncHandler(async (req, res) => {
  const r = await settingsSvc.savePaymentSettings(req.body);
  audit(req, 'payments.update', 'BusinessSettings', 'main', { onlineEnabled: req.body.onlineEnabled, codEnabled: req.body.codEnabled, keyIdChanged: !!req.body.razorpay?.keyId, secretChanged: !!req.body.razorpay?.keySecret }); // never log secrets
  ok(res, r);
}));
router.post('/payment-settings/test', ownerOnly, asyncHandler(async (req, res) => ok(res, await paySvc.testConnection())));
router.put('/settings', managerUp, validate(v.z.object({}).passthrough()), asyncHandler(async (req, res) => {
  const s = await settingsSvc.updateSettings(req.body);
  audit(req, 'settings.update', 'BusinessSettings', s._id);
  ok(res, s);
}));


// ---- SMS / OTP provider (owner only). Secrets are write-only and stored encrypted.
router.get('/sms-settings', ownerOnly, asyncHandler(async (req, res) => ok(res, await settingsSvc.getSmsAdminView())));
router.put('/sms-settings', ownerOnly, validate(v.z.object({
  provider: v.z.enum(['none', 'msg91', 'twilio']).optional(),
  msg91: v.z.object({ authKey: v.z.string().max(200).optional(), templateId: v.z.string().max(100).optional() }).optional(),
  twilio: v.z.object({ accountSid: v.z.string().max(100).optional(), authToken: v.z.string().max(200).optional(), from: v.z.string().max(40).optional() }).optional(),
})), asyncHandler(async (req, res) => { const r = await settingsSvc.saveSmsSettings(req.body); audit(req, 'sms.update', 'BusinessSettings', 'main', { provider: req.body.provider }); ok(res, r); }));
router.post('/sms-settings/test', ownerOnly, validate(v.z.object({ phone: v.z.string().regex(/^[6-9]\d{9}$/) })), asyncHandler(async (req, res) => {
  const r = await require('../services/sms.service').sendOtp(req.body.phone, '123456');
  ok(res, { sent: !r.devOtp, devMode: !!r.devOtp });
}));
// ---- Staff accounts (owner only)
router.get('/staff', ownerOnly, asyncHandler(async (req, res) => ok(res, await User.find({ role: { $ne: 'customer' } }).select('name email phone role isActive'))));
router.post('/staff', ownerOnly, validate(v.staffUser), asyncHandler(async (req, res) => {
  const { password, ...rest } = req.body;
  const u = await User.create({ ...rest, passwordHash: await bcrypt.hash(password, 12), isEmailVerified: true });
  audit(req, 'staff.create', 'User', u._id, { role: u.role });
  ok(res, { id: u._id, name: u.name, role: u.role }, null, 201);
}));
router.patch('/staff/:id', ownerOnly, validate(v.z.object({ isActive: v.z.boolean().optional(), role: v.z.enum(['manager', 'staff']).optional() })), asyncHandler(async (req, res) => {
  const u = await User.findOne({ _id: req.params.id, role: { $ne: 'owner' } });
  if (!u) throw new ApiError(404, 'Staff member not found');
  Object.assign(u, req.body);
  await u.save();
  ok(res, { id: u._id, role: u.role, isActive: u.isActive });
}));
router.get('/audit-log', ownerOnly, asyncHandler(async (req, res) => ok(res, await AuditLog.find().sort({ createdAt: -1 }).limit(100).populate('userId', 'name'))));

module.exports = router;
