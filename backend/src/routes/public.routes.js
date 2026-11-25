const router = require('express').Router();
const { Category, Review, Subscriber, Product, HeroSlide } = require('../models');
const { asyncHandler, ok, ApiError } = require('../utils');
const { validate, optionalAuth, limiter } = require('../middleware');
const v = require('../validators');
const catalog = require('../services/catalog.service');
const pricing = require('../services/pricing.service');
const settingsSvc = require('../services/settings.service');

router.get('/settings', asyncHandler(async (req, res) => {
  const s = await settingsSvc.publicSettings();
  res.set('Cache-Control', 'no-cache');
  ok(res, s);
}));

router.get('/categories', asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-cache');
  ok(res, await Category.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }));
}));

router.get('/hero-slides', asyncHandler(async (req, res) => {
  const slides = await HeroSlide.find({ isActive: true }).sort({ sortOrder: 1, createdAt: 1 }).populate('productId', 'name slug pricePaise isAvailable isArchived foodType preparationTime images');
  res.set('Cache-Control', 'no-cache');
  // a slide linked to an archived product simply loses its product link
  ok(res, slides.map((s) => { const o = s.toObject(); if (o.productId?.isArchived) o.productId = null; return o; }));
}));

router.get('/products', asyncHandler(async (req, res) => {
  const { items, meta } = await catalog.listProducts(req.query);
  res.set('Cache-Control', 'no-cache');
  ok(res, items, meta);
}));
router.get('/products/:slug', asyncHandler(async (req, res) => ok(res, await catalog.getBySlug(req.params.slug))));

router.get('/products/:id/reviews', asyncHandler(async (req, res) => {
  ok(res, await Review.find({ productId: req.params.id, status: 'approved' }).populate('userId', 'name').sort({ createdAt: -1 }).limit(20));
}));
router.get('/reviews', asyncHandler(async (req, res) => {
  ok(res, await Review.find({ status: 'approved' }).populate('userId', 'name').sort({ createdAt: -1 }).limit(9));
}));

// Cart revalidation: prices, availability, coupon, delivery fee are all computed server-side.
router.post('/cart/quote', optionalAuth, validate(v.quote), asyncHandler(async (req, res) => {
  const q = await pricing.quote({ ...req.body, userId: req.user?._id }, { strict: false });
  ok(res, q);
}));

router.post('/delivery/check', validate(v.z.object({ pincode: v.z.string().optional(), lat: v.z.number().optional(), lng: v.z.number().optional() })), asyncHandler(async (req, res) => {
  const s = await settingsSvc.getSettings();
  ok(res, pricing.checkServiceability(s, req.body));
}));

router.post('/newsletter', limiter(60 * 60 * 1000, 10), validate(v.z.object({ email: v.z.string().email(), consent: v.z.literal(true, { errorMap: () => ({ message: 'Consent is required' }) }) })), asyncHandler(async (req, res) => {
  await Subscriber.updateOne({ email: req.body.email.toLowerCase() }, { consent: true }, { upsert: true });
  ok(res, { subscribed: true });
}));

router.get('/health', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

module.exports = router;
