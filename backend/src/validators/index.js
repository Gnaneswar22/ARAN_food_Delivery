const { z } = require('zod');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const phone = z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number');
const password = z.string().min(8, 'At least 8 characters').max(72).regex(/[A-Za-z]/, 'Include a letter').regex(/\d/, 'Include a number');
const paise = z.coerce.number().int().min(0);

const auth = {
  register: z.object({ name: z.string().trim().min(2).max(80), email: z.string().trim().toLowerCase().email(), phone: phone.optional(), password, marketingConsent: z.boolean().optional() }),
  login: z.object({ identifier: z.string().trim().min(3), password: z.string().min(1) }),
  forgot: z.object({ email: z.string().trim().email() }),
  reset: z.object({ token: z.string().min(10), password }),
  changePassword: z.object({ currentPassword: z.string().min(1), newPassword: password }),
  profile: z.object({ name: z.string().trim().min(2).max(80).optional(), phone: phone.optional(), marketingConsent: z.boolean().optional() }),
};

const address = z.object({
  label: z.string().trim().max(30).optional(),
  line1: z.string().trim().min(3).max(200),
  line2: z.string().trim().max(200).optional(),
  landmark: z.string().trim().max(120).optional(),
  city: z.string().trim().min(2).max(80),
  pincode: z.string().trim().regex(/^\d{6}$/, 'Enter a 6-digit PIN code'),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  isDefault: z.boolean().optional(),
});

const cartItem = z.object({
  productId: objectId,
  quantity: z.number().int().min(1).max(50),
  options: z.array(z.object({ groupId: objectId, choiceId: objectId })).max(20).optional(),
  note: z.string().max(200).optional(),
});

const quote = z.object({
  items: z.array(cartItem).max(50),
  orderType: z.enum(['delivery', 'pickup']).default('delivery'),
  address: address.partial().optional(),
  couponCode: z.string().trim().max(30).optional(),
  redeemPoints: z.boolean().optional(),
});

const checkout = z.object({
  items: z.array(cartItem).min(1).max(50),
  orderType: z.enum(['delivery', 'pickup']),
  address: address.optional(),
  deliveryInstructions: z.string().max(300).optional(),
  pickupSlot: z.string().max(40).optional(),
  scheduledFor: z.coerce.date().optional(),
  customer: z.object({ name: z.string().trim().min(2).max(80), phone, email: z.string().trim().email().optional().or(z.literal('').transform(() => undefined)) }),
  couponCode: z.string().trim().max(30).optional(),
  paymentMethod: z.enum(['online', 'cod']),
  redeemPoints: z.boolean().optional(),
  idempotencyKey: z.string().min(8).max(80).optional(),
});

const category = z.object({ name: z.string().trim().min(2).max(60), description: z.string().max(300).optional(), image: z.object({ url: z.string().url(), publicId: z.string().optional() }).optional(), sortOrder: z.number().int().optional(), isActive: z.boolean().optional() });

const product = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().max(1500).optional(),
  categoryId: objectId,
  images: z.array(z.object({ url: z.string().max(500).refine((u) => /^https:\/\//.test(u) || u.startsWith('/images/'), 'Invalid image'), publicId: z.string().optional() })).max(8).optional(),
  pricePaise: paise,
  compareAtPricePaise: paise.optional(),
  foodType: z.enum(['veg', 'non-veg', 'egg']).optional(),
  ingredients: z.array(z.string().trim().max(60)).max(40).optional(),
  allergens: z.array(z.string().trim().max(40)).max(20).optional(),
  portionSize: z.string().max(60).optional(),
  preparationTime: z.number().int().min(0).max(240).optional(),
  isAvailable: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  stockManaged: z.boolean().optional(),
  customizations: z.array(z.object({ name: z.string().min(1), required: z.boolean().optional(), maxSelect: z.number().int().min(1).optional(), choices: z.array(z.object({ label: z.string().min(1), pricePaise: paise.optional() })).min(1) })).max(10).optional(),
});

const coupon = z.object({
  code: z.string().trim().min(3).max(30), description: z.string().max(200).optional(),
  discountType: z.enum(['percentage', 'fixed']), value: z.number().positive(),
  minOrderPaise: paise.optional(), maxDiscountPaise: paise.optional(),
  startsAt: z.coerce.date().optional(), expiresAt: z.coerce.date().optional(),
  usageLimit: z.number().int().positive().optional(), perCustomerLimit: z.number().int().positive().optional(), isActive: z.boolean().optional(),
}).refine((c) => c.discountType !== 'percentage' || c.value <= 100, { message: 'Percentage cannot exceed 100', path: ['value'] });

const heroSlide = z.object({
  title: z.string().trim().min(1).max(80),
  subtitle: z.string().trim().max(200).optional(),
  tag: z.string().trim().max(30).optional(),
  image: z.object({ url: z.string().min(1).max(500).refine((u) => /^https:\/\//.test(u) || u.startsWith('/images/'), 'Image must be an uploaded image'), publicId: z.string().optional() }),
  productId: objectId.nullable().optional(),
  ctaLabel: z.string().trim().max(30).optional(),
  isActive: z.boolean().optional(),
});

const statusChange = z.object({ status: z.enum(['confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'picked_up', 'cancelled']), reason: z.string().max(300).optional(), note: z.string().max(300).optional() });
const stockAdjust = z.object({ productId: objectId, type: z.enum(['add', 'reduce', 'set']), quantity: z.number().int().min(0), note: z.string().max(200).optional() });
const partner = z.object({ name: z.string().trim().min(2), phone, vehicle: z.string().optional(), isActive: z.boolean().optional() });
const review = z.object({ productId: objectId.optional(), orderId: objectId.optional(), rating: z.number().int().min(1).max(5), comment: z.string().max(600).optional() });
const staffUser = z.object({ name: z.string().min(2), email: z.string().email(), phone: phone.optional(), password, role: z.enum(['manager', 'staff']) });
const pushSub = z.object({ endpoint: z.string().url(), keys: z.object({ p256dh: z.string(), auth: z.string() }) }).passthrough();

module.exports = { heroSlide, z, objectId, auth, address, quote, checkout, category, product, coupon, statusChange, stockAdjust, partner, review, staffUser, pushSub };
