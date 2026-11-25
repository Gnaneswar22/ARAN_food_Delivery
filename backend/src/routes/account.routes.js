const router = require('express').Router();
const { User, Address, Order, Review, Notification } = require('../models');
const { asyncHandler, ok, ApiError, pageParams } = require('../utils');
const { authenticate, validate } = require('../middleware');
const v = require('../validators');
const authSvc = require('../services/auth.service');
const catalog = require('../services/catalog.service');

router.use(authenticate);

router.get('/me', (req, res) => ok(res, authSvc.publicUser(req.user)));
router.patch('/me', validate(v.auth.profile), asyncHandler(async (req, res) => {
  Object.assign(req.user, req.body);
  await req.user.save();
  ok(res, authSvc.publicUser(req.user));
}));

// Addresses
router.get('/addresses', asyncHandler(async (req, res) => ok(res, await Address.find({ userId: req.user._id }).sort({ isDefault: -1, createdAt: -1 }))));
router.post('/addresses', validate(v.address), asyncHandler(async (req, res) => {
  const count = await Address.countDocuments({ userId: req.user._id });
  if (count >= 10) throw new ApiError(409, 'Address limit reached');
  if (req.body.isDefault || count === 0) await Address.updateMany({ userId: req.user._id }, { isDefault: false });
  ok(res, await Address.create({ ...req.body, userId: req.user._id, isDefault: req.body.isDefault || count === 0 }), null, 201);
}));
router.put('/addresses/:id', validate(v.address.partial()), asyncHandler(async (req, res) => {
  if (req.body.isDefault) await Address.updateMany({ userId: req.user._id }, { isDefault: false });
  const a = await Address.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, req.body, { returnDocument: 'after' });
  if (!a) throw new ApiError(404, 'Address not found');
  ok(res, a);
}));
router.delete('/addresses/:id', asyncHandler(async (req, res) => {
  const a = await Address.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!a) throw new ApiError(404, 'Address not found');
  ok(res, { deleted: true });
}));

router.get('/loyalty', asyncHandler(async (req, res) => ok(res, await require('../services/loyalty.service').summary(req.user))));

// Wishlist
router.get('/wishlist', asyncHandler(async (req, res) => {
  const u = await User.findById(req.user._id).populate({ path: 'wishlist', match: { isArchived: false } });
  ok(res, await catalog.decorate(u.wishlist));
}));
router.post('/wishlist/:productId', asyncHandler(async (req, res) => { await User.updateOne({ _id: req.user._id }, { $addToSet: { wishlist: req.params.productId } }); ok(res, { added: true }); }));
router.delete('/wishlist/:productId', asyncHandler(async (req, res) => { await User.updateOne({ _id: req.user._id }, { $pull: { wishlist: req.params.productId } }); ok(res, { removed: true }); }));

// Server-side cart (synced from guest cart on login)
router.get('/cart', (req, res) => ok(res, req.user.cart));
router.put('/cart', validate(v.z.object({ items: v.z.array(v.z.object({ productId: v.objectId, quantity: v.z.number().int().min(1).max(50), options: v.z.array(v.z.any()).optional(), note: v.z.string().max(200).optional() }).passthrough()).max(50) })), asyncHandler(async (req, res) => {
  req.user.cart = req.body.items;
  await req.user.save();
  ok(res, req.user.cart);
}));

// Reviews (only for products the customer actually received)
router.post('/reviews', validate(v.review), asyncHandler(async (req, res) => {
  const { productId, orderId } = req.body;
  const bought = await Order.findOne({ userId: req.user._id, orderStatus: { $in: ['delivered', 'picked_up'] }, ...(orderId ? { _id: orderId } : {}), ...(productId ? { 'items.productId': productId } : {}) });
  if (!bought) throw new ApiError(403, 'You can review only completed orders');
  ok(res, await Review.create({ ...req.body, orderId: bought._id, userId: req.user._id }), null, 201);
}));
router.get('/reviews', asyncHandler(async (req, res) => ok(res, await Review.find({ userId: req.user._id }).populate('productId', 'name slug').sort({ createdAt: -1 }))));

// Notifications
router.get('/notifications', asyncHandler(async (req, res) => {
  const { skip, limit } = pageParams(req.query);
  const isAdmin = ['owner', 'manager', 'staff'].includes(req.user.role);
  const filter = isAdmin ? { audience: 'admin' } : { userId: req.user._id };
  const [items, unread] = await Promise.all([Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit), Notification.countDocuments({ ...filter, readAt: null })]);
  ok(res, items, { unread });
}));
router.post('/notifications/read', asyncHandler(async (req, res) => {
  const filter = ['owner', 'manager', 'staff'].includes(req.user.role) ? { audience: 'admin' } : { userId: req.user._id };
  await Notification.updateMany({ ...filter, readAt: null }, { readAt: new Date() });
  ok(res, { read: true });
}));
router.post('/push/subscribe', validate(v.pushSub), asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $pull: { pushSubscriptions: { endpoint: req.body.endpoint } } });
  await User.updateOne({ _id: req.user._id }, { $push: { pushSubscriptions: req.body } });
  ok(res, { subscribed: true });
}));

module.exports = router;
