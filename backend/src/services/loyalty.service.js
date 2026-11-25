/** Loyalty points + referrals. Points are integers; 1 point = settings.loyalty.pointValuePaise. All balance changes are atomic and idempotent. */
const crypto = require('crypto');
const { User, Order, LoyaltyTxn } = require('../models');
const { getSettings } = require('./settings.service');
const { notify } = require('./notify.service');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from(crypto.randomBytes(6), (b) => ALPHABET[b % ALPHABET.length]).join('');

async function ensureReferralCode(user) {
  if (user.referralCode) return user.referralCode;
  for (let i = 0; i < 5; i++) {
    const code = newCode();
    try { const u = await User.findOneAndUpdate({ _id: user._id, referralCode: { $exists: false } }, { referralCode: code }, { returnDocument: 'after' }); return u?.referralCode || (await User.findById(user._id)).referralCode; }
    catch (e) { if (e.code !== 11000) throw e; }
  }
  return undefined;
}

async function credit(userId, points, reason, orderId) {
  if (!points) return;
  await User.updateOne({ _id: userId }, { $inc: { loyaltyPoints: points } });
  await LoyaltyTxn.create({ userId, points, reason, orderId });
}

/** Atomically spend points; returns false if the balance is insufficient. */
async function spend(userId, points, orderId) {
  if (!points) return true;
  const u = await User.findOneAndUpdate({ _id: userId, loyaltyPoints: { $gte: points } }, { $inc: { loyaltyPoints: -points } });
  if (!u) return false;
  await LoyaltyTxn.create({ userId, points: -points, reason: 'Redeemed on order', orderId });
  return true;
}

/** Given a subtotal after coupons, how many points can this user redeem and what is the discount? */
async function redemption(user, amountAfterCouponPaise) {
  const s = (await getSettings()).loyalty || {};
  if (s.enabled === false || !user || user.loyaltyPoints <= 0) return { points: 0, discountPaise: 0 };
  const value = s.pointValuePaise || 50;
  const cap = Math.floor((amountAfterCouponPaise * (s.maxRedeemPercent ?? 20)) / 100);
  const points = Math.min(user.loyaltyPoints, Math.floor(cap / value));
  return { points, discountPaise: points * value };
}

async function refundRedeemed(order) {
  if (!order.pointsRedeemed || !order.userId) return;
  const claimed = await Order.findOneAndUpdate({ _id: order._id, pointsRefunded: false }, { pointsRefunded: true });
  if (claimed) await credit(order.userId, order.pointsRedeemed, 'Points returned (order cancelled)', order._id);
}

/** Called once an order is delivered / picked up: earn points, and pay the referral bonus after the referee's first completed order. */
async function onOrderCompleted(order) {
  if (!order.userId) return;
  const s = (await getSettings()).loyalty || {};
  if (s.enabled === false) return;
  const claimed = await Order.findOneAndUpdate({ _id: order._id, pointsAwarded: false }, { pointsAwarded: true });
  if (!claimed) return;
  const paidBase = Math.max(0, order.pricingSnapshot.subtotalPaise - order.pricingSnapshot.discountPaise);
  const earned = Math.floor((paidBase / 10000) * (s.earnPointsPer100Rupees ?? 5));
  if (earned > 0) {
    await credit(order.userId, earned, 'Earned on order', order._id);
    notify({ userId: order.userId, type: 'loyalty.earned', title: `+${earned} points`, body: `You earned ${earned} ARAN.co points on ${order.orderNumber}.`, data: { orderId: order._id } });
  }
  const user = await User.findById(order.userId);
  if (user?.referredBy && bonusOn(s)) {
    const first = await User.findOneAndUpdate({ _id: user._id, referralRewarded: false }, { referralRewarded: true });
    if (first) {
      await credit(user._id, s.referralBonusPoints, 'Welcome referral bonus', order._id);
      await credit(user.referredBy, s.referralBonusPoints, 'Referral bonus: a friend completed their first order', order._id);
      notify({ userId: user.referredBy, type: 'loyalty.referral', title: 'Referral reward', body: `A friend placed their first order — you both earned ${s.referralBonusPoints} points!` });
    }
  }
}
const bonusOn = (s) => (s.referralBonusPoints ?? 100) > 0;

/** Links a brand-new user to the referrer. Silently ignores unknown codes / self-referrals. */
async function applyReferral(newUser, code) {
  if (!code) return;
  const referrer = await User.findOne({ referralCode: String(code).toUpperCase().trim() });
  if (!referrer || String(referrer._id) === String(newUser._id)) return;
  await User.updateOne({ _id: newUser._id, referredBy: { $exists: false } }, { referredBy: referrer._id });
}

async function summary(user) {
  const s = (await getSettings()).loyalty || {};
  const [code, history] = await Promise.all([ensureReferralCode(user), LoyaltyTxn.find({ userId: user._id }).sort({ createdAt: -1 }).limit(30)]);
  const fresh = await User.findById(user._id);
  return { enabled: s.enabled !== false, points: fresh.loyaltyPoints, pointValuePaise: s.pointValuePaise || 50, referralCode: code, referralBonusPoints: s.referralBonusPoints ?? 100, history };
}

module.exports = { credit, spend, redemption, refundRedeemed, onOrderCompleted, applyReferral, summary, ensureReferralCode };
