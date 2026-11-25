const mongoose = require('mongoose');
const { Schema } = mongoose;
const oid = Schema.Types.ObjectId;
const opts = { timestamps: true };

const User = mongoose.model(
  'User',
  new Schema(
    {
      name: { type: String, required: true, trim: true },
      email: { type: String, lowercase: true, trim: true, sparse: true, unique: true },
      phone: { type: String, trim: true, sparse: true, unique: true },
      passwordHash: { type: String, select: false },
      role: { type: String, enum: ['customer', 'owner', 'manager', 'staff', 'delivery'], default: 'customer', index: true },
      isActive: { type: Boolean, default: true },
      isPhoneVerified: { type: Boolean, default: false },
      isEmailVerified: { type: Boolean, default: false },
      isGuest: { type: Boolean, default: false },
      activationToken: { type: String, select: false },
      resetTokenHash: { type: String, select: false },
      resetTokenExpires: { type: Date, select: false },
      wishlist: [{ type: oid, ref: 'Product' }],
      cart: [Schema.Types.Mixed], // minimal client cart snapshot; prices are always recomputed server-side
      pushSubscriptions: [Schema.Types.Mixed],
      marketingConsent: { type: Boolean, default: false },
      loyaltyPoints: { type: Number, default: 0, min: 0 },
      referralCode: { type: String, unique: true, sparse: true },
      referredBy: { type: oid, ref: 'User' },
      referralRewarded: { type: Boolean, default: false },
    },
    opts
  )
);

const Category = mongoose.model(
  'Category',
  new Schema(
    {
      name: { type: String, required: true, trim: true },
      slug: { type: String, required: true, unique: true },
      description: String,
      image: { url: String, publicId: String },
      sortOrder: { type: Number, default: 0 },
      isActive: { type: Boolean, default: true },
    },
    opts
  )
);

const customizationSchema = new Schema(
  {
    name: String,
    required: { type: Boolean, default: false },
    maxSelect: { type: Number, default: 1 },
    choices: [{ label: String, pricePaise: { type: Number, default: 0 } }],
  },
  { _id: true }
);

const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, default: '' },
    categoryId: { type: oid, ref: 'Category', required: true, index: true },
    images: [{ url: String, publicId: String }],
    pricePaise: { type: Number, required: true, min: 0 },
    compareAtPricePaise: { type: Number, min: 0 },
    foodType: { type: String, enum: ['veg', 'non-veg', 'egg'], default: 'veg' },
    ingredients: [String],
    allergens: [String],
    portionSize: String,
    preparationTime: { type: Number, default: 15 },
    isAvailable: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    stockManaged: { type: Boolean, default: false },
    customizations: [customizationSchema],
    isArchived: { type: Boolean, default: false, index: true },
    soldCount: { type: Number, default: 0 },
  },
  opts
);
productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ isArchived: 1, isAvailable: 1, categoryId: 1, pricePaise: 1 });
const Product = mongoose.model('Product', productSchema);

const Address = mongoose.model(
  'Address',
  new Schema(
    {
      userId: { type: oid, ref: 'User', required: true, index: true },
      label: { type: String, default: 'Home' },
      line1: { type: String, required: true },
      line2: String,
      landmark: String,
      city: { type: String, required: true },
      pincode: { type: String, required: true },
      lat: Number,
      lng: Number,
      isDefault: { type: Boolean, default: false },
    },
    opts
  )
);

const orderItem = new Schema(
  {
    productId: { type: oid, ref: 'Product' },
    name: String,
    image: String,
    foodType: String,
    unitPricePaise: Number,
    quantity: Number,
    options: [{ group: String, label: String, pricePaise: Number }],
    note: String,
    lineTotalPaise: Number,
  },
  { _id: false }
);

const orderSchema = new Schema(
  {
    orderNumber: { type: String, unique: true, required: true },
    userId: { type: oid, ref: 'User', index: true },
    customer: { name: String, phone: String, email: String },
    items: [orderItem],
    orderType: { type: String, enum: ['delivery', 'pickup'], required: true },
    deliveryAddressSnapshot: Schema.Types.Mixed,
    deliveryInstructions: String,
    pickupDetailsSnapshot: Schema.Types.Mixed,
    pricingSnapshot: {
      subtotalPaise: Number,
      discountPaise: Number,
      taxPaise: Number,
      deliveryFeePaise: Number,
      totalPaise: Number,
      couponCode: String,
      loyaltyDiscountPaise: { type: Number, default: 0 },
      pointsRedeemed: { type: Number, default: 0 },
    },
    paymentMethod: { type: String, enum: ['online', 'cod'], required: true },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'unpaid', 'refunded', 'partially_refunded'], default: 'pending' },
    orderStatus: {
      type: String,
      enum: ['pending_payment', 'placed', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'picked_up', 'cancelled'],
      default: 'placed',
      index: true,
    },
    deliveryPartnerId: { type: oid, ref: 'DeliveryPartner' },
    scheduledFor: Date,
    cancellationReason: String,
    refundedPaise: { type: Number, default: 0 },
    codCollection: [{ amountPaise: Number, collectedBy: { type: oid, ref: 'User' }, at: Date, note: String }],
    deliveryCode: { type: String, select: false }, // 4-digit handover code the customer shows the rider
    pointsRedeemed: { type: Number, default: 0 },
    pointsRefunded: { type: Boolean, default: false },
    pointsAwarded: { type: Boolean, default: false },
    stockReleased: { type: Boolean, default: false },
    stockDeducted: { type: Boolean, default: false },
    idempotencyKey: { type: String },
    statusHistory: [{ status: String, at: { type: Date, default: Date.now }, by: { type: oid, ref: 'User' }, note: String }],
    guestToken: { type: String, select: false },
  },
  opts
);
orderSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ orderType: 1, orderStatus: 1 });
const Order = mongoose.model('Order', orderSchema);

const Payment = mongoose.model(
  'Payment',
  new Schema(
    {
      orderId: { type: oid, ref: 'Order', index: true },
      userId: { type: oid, ref: 'User' },
      provider: { type: String, default: 'razorpay' },
      providerOrderId: { type: String, index: true },
      providerPaymentId: { type: String, sparse: true, unique: true },
      amountPaise: Number,
      currency: { type: String, default: 'INR' },
      status: { type: String, enum: ['created', 'captured', 'failed', 'refunded', 'partially_refunded'], default: 'created' },
      signatureVerified: { type: Boolean, default: false },
      webhookEventIds: [String],
      refunds: [{ refundId: String, amountPaise: Number, reason: String, at: { type: Date, default: Date.now } }],
      failureReason: String,
    },
    opts
  )
);

const Inventory = mongoose.model(
  'Inventory',
  new Schema(
    {
      productId: { type: oid, ref: 'Product', unique: true, required: true },
      availableQuantity: { type: Number, default: 0, min: 0 },
      reservedQuantity: { type: Number, default: 0, min: 0 },
      lowStockThreshold: { type: Number, default: 5 },
      isAvailable: { type: Boolean, default: true },
    },
    opts
  )
);

const InventoryTransaction = mongoose.model(
  'InventoryTransaction',
  new Schema(
    {
      productId: { type: oid, ref: 'Product', index: true },
      type: { type: String, enum: ['add', 'reduce', 'reserve', 'release', 'deduct', 'set'] },
      quantity: Number,
      orderId: { type: oid, ref: 'Order' },
      note: String,
      by: { type: oid, ref: 'User' },
    },
    opts
  )
);

const Coupon = mongoose.model(
  'Coupon',
  new Schema(
    {
      code: { type: String, required: true, unique: true, uppercase: true, trim: true },
      description: String,
      discountType: { type: String, enum: ['percentage', 'fixed'], required: true },
      value: { type: Number, required: true }, // percent or paise
      minOrderPaise: { type: Number, default: 0 },
      maxDiscountPaise: Number,
      startsAt: Date,
      expiresAt: Date,
      usageLimit: Number,
      perCustomerLimit: Number,
      usedCount: { type: Number, default: 0 },
      usedBy: [{ userId: oid, count: Number }],
      isActive: { type: Boolean, default: true },
    },
    opts
  )
);

const Review = mongoose.model(
  'Review',
  new Schema(
    {
      userId: { type: oid, ref: 'User', required: true },
      productId: { type: oid, ref: 'Product' },
      orderId: { type: oid, ref: 'Order' },
      rating: { type: Number, min: 1, max: 5, required: true },
      comment: String,
      status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    },
    opts
  )
);

const DeliveryPartner = mongoose.model(
  'DeliveryPartner',
  new Schema({ name: { type: String, required: true }, phone: { type: String, required: true }, vehicle: String, userId: { type: oid, ref: 'User' }, isActive: { type: Boolean, default: true }, lastLocation: { lat: Number, lng: Number, at: Date } }, opts)
);

const Notification = mongoose.model(
  'Notification',
  new Schema(
    {
      userId: { type: oid, ref: 'User', index: true },
      audience: { type: String, enum: ['customer', 'admin'], default: 'customer' },
      type: String,
      title: String,
      body: String,
      data: Schema.Types.Mixed,
      readAt: Date,
    },
    opts
  )
);

const BusinessSettings = mongoose.model(
  'BusinessSettings',
  new Schema(
    {
      key: { type: String, default: 'main', unique: true },
      brand: {
        name: { type: String, default: 'ARAN.co' },
        logo: String,
        email: String,
        phone: String,
        social: { instagram: String, facebook: String, x: String },
        story: { type: String, default: 'ARAN.co is a modern kitchen focused on fresh, thoughtfully prepared food.' },
        promo: { title: { type: String, default: 'Something Delicious Is Waiting.' }, subtitle: String, ctaLabel: { type: String, default: 'Explore Our Menu' }, image: String },
      },
      stall: { address: String, lat: Number, lng: Number, phone: String },
      timings: {
        open: { type: String, default: '10:00' },
        close: { type: String, default: '22:00' },
        weeklyHolidays: [Number], // 0=Sun
        temporaryClosure: { type: Boolean, default: false },
        acceptingOrders: { type: Boolean, default: true },
      },
      delivery: {
        enabled: { type: Boolean, default: true },
        radiusKm: { type: Number, default: 5 },
        feePaise: { type: Number, default: 4000 },
        minOrderPaise: { type: Number, default: 15000 },
        freeDeliveryThresholdPaise: { type: Number, default: 50000 },
        pincodes: [String],
        autoAssign: { type: Boolean, default: false },
      },
      pickup: { enabled: { type: Boolean, default: true }, address: String, prepMinutes: { type: Number, default: 20 }, slots: [String] },
      loyalty: {
        enabled: { type: Boolean, default: true },
        earnPointsPer100Rupees: { type: Number, default: 5 },
        pointValuePaise: { type: Number, default: 50 }, // 1 point = ₹0.50
        maxRedeemPercent: { type: Number, default: 20 },
        referralBonusPoints: { type: Number, default: 100 },
      },
      tax: { percent: { type: Number, default: 5 }, inclusive: { type: Boolean, default: false } },
      payments: {
        onlineEnabled: { type: Boolean, default: true },
        codEnabled: { type: Boolean, default: true },
        razorpay: { keyId: String, keySecretEnc: String, webhookSecretEnc: String }, // secrets AES-GCM encrypted at rest
      },
      guestCheckout: { type: Boolean, default: false }, // default: customers must verify their mobile number (OTP) to order
      sms: {
        provider: { type: String, enum: ['none', 'msg91', 'twilio'], default: 'none' },
        msg91: { authKeyEnc: String, templateId: String },
        twilio: { accountSid: String, authTokenEnc: String, from: String },
      },
      notifications: { newOrderAlerts: { type: Boolean, default: true }, customerUpdates: { type: Boolean, default: true }, emailEnabled: { type: Boolean, default: false }, whatsappEnabled: { type: Boolean, default: false } },
    },
    opts
  )
);

const RefreshToken = mongoose.model(
  'RefreshToken',
  new Schema(
    {
      userId: { type: oid, ref: 'User', index: true },
      tokenHash: { type: String, unique: true },
      family: String,
      expiresAt: { type: Date, index: { expires: 0 } },
      revokedAt: Date,
      replacedBy: String,
    },
    opts
  )
);

const AuditLog = mongoose.model(
  'AuditLog',
  new Schema({ userId: { type: oid, ref: 'User' }, action: String, entity: String, entityId: String, meta: Schema.Types.Mixed }, opts)
);

// Homepage hero showcase: items that change as the visitor scrolls. Fully admin-managed.
const HeroSlide = mongoose.model(
  'HeroSlide',
  new Schema(
    {
      title: { type: String, required: true, trim: true },
      subtitle: { type: String, default: '' },
      tag: { type: String, default: '' },
      image: { url: { type: String, required: true }, publicId: String },
      productId: { type: oid, ref: 'Product' }, // optional: links the slide to a menu item
      ctaLabel: { type: String, default: 'Order now' },
      sortOrder: { type: Number, default: 0 },
      isActive: { type: Boolean, default: true },
    },
    opts
  )
);

const Otp = mongoose.model(
  'Otp',
  new Schema({ phone: { type: String, index: true }, codeHash: String, expiresAt: { type: Date, index: { expires: 0 } }, attempts: { type: Number, default: 0 }, sentAt: Date, ip: String }, opts)
);

const LoyaltyTxn = mongoose.model('LoyaltyTxn', new Schema({ userId: { type: oid, ref: 'User', index: true }, points: Number, reason: String, orderId: { type: oid, ref: 'Order' } }, opts));

const Counter = mongoose.model('Counter', new Schema({ _id: String, seq: { type: Number, default: 0 } }));

const Subscriber = mongoose.model('Subscriber', new Schema({ email: { type: String, unique: true, lowercase: true }, consent: Boolean }, opts));

module.exports = {
  User, Category, Product, Address, Order, Payment, Inventory, InventoryTransaction, Coupon, Review,
  DeliveryPartner, Notification, BusinessSettings, RefreshToken, AuditLog, Counter, Subscriber, HeroSlide, Otp, LoyaltyTxn,
};
