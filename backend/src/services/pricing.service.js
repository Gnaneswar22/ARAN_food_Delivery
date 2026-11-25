/** Single source of truth for cart validation, coupon + delivery + tax math. All amounts in integer paise. */
const { Product, Inventory, Coupon, User } = require('../models');
const loyalty = require('./loyalty.service');
const { ApiError, haversineKm } = require('../utils');
const { getSettings } = require('./settings.service');

function checkServiceability(s, address) {
  const d = s.delivery || {};
  if (d.enabled === false) return { ok: false, message: 'Home delivery is currently unavailable. Please choose pickup.' };
  const pins = d.pincodes || [];
  const hasCoords = s.stall?.lat != null && s.stall?.lng != null && address?.lat != null && address?.lng != null;
  if (pins.length && address?.pincode) {
    if (pins.includes(String(address.pincode))) return { ok: true };
    if (!hasCoords) return { ok: false, message: 'Sorry, we do not deliver to this PIN code yet. Please choose pickup.' };
  }
  if (hasCoords && d.radiusKm) {
    const km = haversineKm(s.stall.lat, s.stall.lng, address.lat, address.lng);
    return km <= d.radiusKm ? { ok: true, distanceKm: +km.toFixed(2) } : { ok: false, message: `This address is ${km.toFixed(1)} km away, outside our ${d.radiusKm} km delivery area. Please choose pickup.` };
  }
  if (pins.length) return { ok: false, message: 'Sorry, we do not deliver to this PIN code yet. Please choose pickup.' };
  return { ok: true };
}

async function evaluateCoupon(code, subtotalPaise, userId) {
  const c = await Coupon.findOne({ code: String(code).toUpperCase().trim() });
  const now = new Date();
  if (!c || !c.isActive) throw new ApiError(400, 'Invalid coupon code');
  if (c.startsAt && c.startsAt > now) throw new ApiError(400, 'This coupon is not active yet');
  if (c.expiresAt && c.expiresAt < now) throw new ApiError(400, 'This coupon has expired');
  if (c.usageLimit != null && c.usedCount >= c.usageLimit) throw new ApiError(400, 'This coupon has reached its usage limit');
  if (subtotalPaise < c.minOrderPaise) throw new ApiError(400, `Minimum order of ₹${(c.minOrderPaise / 100).toFixed(0)} required for this coupon`);
  if (c.perCustomerLimit != null) {
    if (!userId) throw new ApiError(400, 'Please sign in to use this coupon');
    const used = c.usedBy.find((u) => String(u.userId) === String(userId))?.count || 0;
    if (used >= c.perCustomerLimit) throw new ApiError(400, 'You have already used this coupon the maximum number of times');
  }
  let discount = c.discountType === 'percentage' ? Math.floor((subtotalPaise * c.value) / 100) : c.value;
  if (c.maxDiscountPaise != null) discount = Math.min(discount, c.maxDiscountPaise);
  discount = Math.min(discount, subtotalPaise);
  return { coupon: c, discountPaise: discount };
}

/**
 * @param {{items:Array, orderType:'delivery'|'pickup', address?:object, couponCode?:string, userId?:string}} input
 * @param {{strict?:boolean}} opts strict=true throws on unavailable lines (checkout); false reports issues (cart view)
 */
async function quote({ items, orderType = 'delivery', address, couponCode, userId, redeemPoints = false }, { strict = true } = {}) {
  const s = await getSettings();
  const ids = items.map((i) => i.productId);
  const [products, invs] = await Promise.all([Product.find({ _id: { $in: ids } }), Inventory.find({ productId: { $in: ids } })]);
  const pMap = new Map(products.map((p) => [String(p._id), p]));
  const iMap = new Map(invs.map((i) => [String(i.productId), i]));

  const lines = [];
  const issues = [];
  for (const it of items) {
    const p = pMap.get(String(it.productId));
    const fail = (msg) => { if (strict) throw new ApiError(409, msg); issues.push({ productId: it.productId, message: msg }); };
    if (!p || p.isArchived) { fail('An item in your cart is no longer available'); continue; }
    if (!p.isAvailable) { fail(`"${p.name}" is currently unavailable`); continue; }
    if (p.stockManaged) {
      const inv = iMap.get(String(p._id));
      if (!inv || !inv.isAvailable || inv.availableQuantity < it.quantity) { fail(`Only ${inv?.availableQuantity ?? 0} of "${p.name}" left in stock`); continue; }
    }
    // customizations
    const chosen = [];
    for (const g of p.customizations) {
      const picks = (it.options || []).filter((o) => String(o.groupId) === String(g._id));
      if (g.required && !picks.length) throw new ApiError(422, `Please choose an option for "${g.name}"`);
      if (picks.length > g.maxSelect) throw new ApiError(422, `Too many choices for "${g.name}"`);
      for (const pk of picks) {
        const ch = g.choices.id(pk.choiceId);
        if (!ch) throw new ApiError(422, `Invalid option for "${g.name}"`);
        chosen.push({ group: g.name, label: ch.label, pricePaise: ch.pricePaise });
      }
    }
    const unit = p.pricePaise + chosen.reduce((a, c) => a + c.pricePaise, 0);
    lines.push({
      productId: p._id, name: p.name, slug: p.slug, image: p.images?.[0]?.url, foodType: p.foodType, stockManaged: p.stockManaged,
      unitPricePaise: unit, quantity: it.quantity, options: chosen, note: it.note, lineTotalPaise: unit * it.quantity, prepTime: p.preparationTime,
    });
  }

  const subtotalPaise = lines.reduce((a, l) => a + l.lineTotalPaise, 0);
  let discountPaise = 0, couponInfo = null, couponError = null;
  if (couponCode && lines.length) {
    try {
      const r = await evaluateCoupon(couponCode, subtotalPaise, userId);
      discountPaise = r.discountPaise;
      couponInfo = { code: r.coupon.code, description: r.coupon.description };
    } catch (e) { if (strict) throw e; couponError = e.message; }
  }

  let pointsRedeemed = 0, loyaltyDiscountPaise = 0;
  if (redeemPoints && userId && lines.length) {
    const r = await loyalty.redemption(await User.findById(userId), subtotalPaise - discountPaise);
    pointsRedeemed = r.points; loyaltyDiscountPaise = r.discountPaise; discountPaise += loyaltyDiscountPaise; // folded into discount so reports stay consistent
  }

  const taxable = subtotalPaise - discountPaise;
  const taxPaise = s.tax?.inclusive ? 0 : Math.round((taxable * (s.tax?.percent || 0)) / 100);

  let deliveryFeePaise = 0, serviceable = { ok: true };
  if (orderType === 'delivery') {
    serviceable = checkServiceability(s, address);
    if (!serviceable.ok && strict) throw new ApiError(422, serviceable.message, { code: 'OUT_OF_AREA' });
    const d = s.delivery;
    deliveryFeePaise = d.freeDeliveryThresholdPaise && subtotalPaise >= d.freeDeliveryThresholdPaise ? 0 : d.feePaise;
    if (subtotalPaise < (d.minOrderPaise || 0)) {
      const m = `Minimum order for delivery is ₹${(d.minOrderPaise / 100).toFixed(0)}`;
      if (strict) throw new ApiError(422, m, { code: 'MIN_ORDER' });
      issues.push({ message: m });
    }
  } else if (s.pickup?.enabled === false) throw new ApiError(422, 'Pickup is currently unavailable');

  if (strict && !lines.length) throw new ApiError(422, 'Your cart is empty');
  const totalPaise = taxable + taxPaise + deliveryFeePaise;
  const prep = Math.max(s.pickup?.prepMinutes || 20, ...lines.map((l) => l.prepTime || 0));
  return {
    lines, issues, couponError, serviceable, estimatedPrepMinutes: prep,
    pricing: { subtotalPaise, discountPaise, taxPaise, deliveryFeePaise, totalPaise, couponCode: couponInfo?.code, loyaltyDiscountPaise, pointsRedeemed },
    coupon: couponInfo,
  };
}

module.exports = { quote, evaluateCoupon, checkServiceability };
