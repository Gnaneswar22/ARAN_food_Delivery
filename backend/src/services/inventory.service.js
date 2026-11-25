/**
 * Stock lifecycle (only for products with stockManaged=true):
 *  RESERVE  at order creation  : available -= q, reserved += q   (atomic, conditional on available >= q => no overselling)
 *  RELEASE  on cancel / payment timeout : available += q, reserved -= q
 *  DEDUCT   on delivered / picked_up    : reserved -= q (stock leaves permanently)
 */
const { Inventory, InventoryTransaction, Product } = require('../models');
const { ApiError } = require('../utils');
const { notify } = require('./notify.service');

const managed = (items) => items.filter((i) => i.stockManaged);

async function reserve(orderId, items) {
  const done = [];
  try {
    for (const it of managed(items)) {
      const r = await Inventory.findOneAndUpdate(
        { productId: it.productId, isAvailable: true, availableQuantity: { $gte: it.quantity } },
        { $inc: { availableQuantity: -it.quantity, reservedQuantity: it.quantity } },
        { returnDocument: 'after' }
      );
      if (!r) throw new ApiError(409, `"${it.name}" is out of stock or has insufficient quantity`);
      done.push(it);
      await InventoryTransaction.create({ productId: it.productId, type: 'reserve', quantity: it.quantity, orderId });
      if (r.availableQuantity <= r.lowStockThreshold) lowStockAlert(it, r);
    }
  } catch (e) {
    await release(orderId, done);
    throw e;
  }
}

async function release(orderId, items) {
  for (const it of managed(items)) {
    await Inventory.updateOne({ productId: it.productId }, { $inc: { availableQuantity: it.quantity, reservedQuantity: -it.quantity } });
    await InventoryTransaction.create({ productId: it.productId, type: 'release', quantity: it.quantity, orderId });
  }
}

async function deduct(orderId, items) {
  for (const it of items) {
    await Product.updateOne({ _id: it.productId }, { $inc: { soldCount: it.quantity } });
  }
  for (const it of managed(items)) {
    await Inventory.updateOne({ productId: it.productId }, { $inc: { reservedQuantity: -it.quantity } });
    await InventoryTransaction.create({ productId: it.productId, type: 'deduct', quantity: it.quantity, orderId });
  }
}

function lowStockAlert(it, inv) {
  notify({ audience: 'admin', type: 'inventory.low', title: 'Low stock', body: `${it.name}: ${inv.availableQuantity} left`, data: { productId: it.productId } });
}

async function adjust({ productId, type, quantity, note, by }) {
  const product = await Product.findById(productId);
  if (!product) throw new ApiError(404, 'Product not found');
  let inv = await Inventory.findOne({ productId });
  if (!inv) inv = await Inventory.create({ productId, availableQuantity: 0 });
  if (type === 'add') inv.availableQuantity += quantity;
  else if (type === 'reduce') {
    if (inv.availableQuantity < quantity) throw new ApiError(409, 'Cannot reduce below zero');
    inv.availableQuantity -= quantity;
  } else if (type === 'set') inv.availableQuantity = quantity;
  await inv.save();
  await InventoryTransaction.create({ productId, type, quantity, note, by });
  if (!product.stockManaged) { product.stockManaged = true; await product.save(); }
  if (inv.availableQuantity <= inv.lowStockThreshold) lowStockAlert({ name: product.name, productId }, inv);
  return inv;
}

module.exports = { reserve, release, deduct, adjust };
