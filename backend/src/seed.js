/** Idempotent bootstrap: owner account, default settings, and (non-production or SEED_DEMO=1) a starter menu. */
const bcrypt = require('bcryptjs');
const { User, Category, Product, Inventory, Coupon, HeroSlide } = require('./models');
const config = require('./config');
const { slugify } = require('./utils');
const { getSettings } = require('./services/settings.service');

async function seed() {
  const email = (process.env.SEED_OWNER_EMAIL || (config.isProd ? '' : 'owner@aran.local')).toLowerCase();
  const pass = process.env.SEED_OWNER_PASSWORD || (config.isProd ? '' : 'Aran@12345');
  if (email && pass && !(await User.exists({ role: 'owner' }))) {
    await User.create({ name: 'ARAN Owner', email, passwordHash: await bcrypt.hash(pass, 12), role: 'owner', isEmailVerified: true });
    console.log(`[seed] owner created: ${email}`);
  }
  await getSettings(true);

  // The four signature items: real, orderable products (prices are starting defaults — edit them in Admin → Products)
  // and the matching homepage hero slides (Admin → Homepage hero).
  const signature = [
    { name: 'Classic Tiramisu', cat: 'Desserts', pricePaise: 16900, foodType: 'veg', allergens: ['Gluten', 'Milk', 'Egg', 'Caffeine'], desc: 'Espresso-soaked layers under a dusting of cocoa.', tag: 'Bestseller', file: 'classic-tiramisu' },
    { name: 'Biscoff Tiramisu', cat: 'Desserts', pricePaise: 17900, foodType: 'veg', allergens: ['Gluten', 'Milk', 'Egg'], desc: 'Creamy mascarpone layered with crunchy biscuit crumble.', tag: 'New', file: 'biscoff-tiramisu' },
    { name: 'Veg Chips Salad', cat: 'Salads', pricePaise: 14900, foodType: 'veg', allergens: [], desc: 'Crisp greens, corn, olives and spiced chips with creamy dressing.', tag: 'Fresh', file: 'veg-chips-salad' },
    { name: 'Chicken Salad Chips Bowl', cat: 'Salads', pricePaise: 19900, foodType: 'non-veg', allergens: [], desc: 'Grilled chicken, crunchy chips and a herby dressing.', tag: 'Hearty', file: 'chicken-salad-chips-bowl' },
  ];
  if (!(await HeroSlide.countDocuments())) {
    let order = (await Category.countDocuments()) ? await Category.countDocuments() : 0;
    for (const [i, s] of signature.entries()) {
      let cat = await Category.findOne({ name: s.cat });
      if (!cat) cat = await Category.create({ name: s.cat, slug: slugify(s.cat), sortOrder: order++, description: s.cat === 'Desserts' ? 'Sweet endings, made fresh.' : 'Fresh, filling and crunchy.' });
      let p = await Product.findOne({ slug: slugify(s.name) });
      if (!p) p = await Product.create({ name: s.name, slug: slugify(s.name), description: s.desc, categoryId: cat._id, pricePaise: s.pricePaise, foodType: s.foodType, allergens: s.allergens, images: [{ url: `/images/hero/${s.file}.webp` }], isFeatured: true, isBestseller: s.tag === 'Bestseller', preparationTime: 10 });
      await HeroSlide.create({ title: s.name, subtitle: s.desc, tag: s.tag, image: { url: `/images/hero/${s.file}.webp` }, productId: p._id, ctaLabel: 'Order now', sortOrder: i });
    }
    console.log('[seed] signature products + hero slides created');
  }
  if ((config.isProd && process.env.SEED_DEMO !== '1') || (await Category.exists({ name: 'Burgers' }))) return;
  const menu = {
    Burgers: ['A flame-grilled stack, built to order.', [['Classic ARAN Burger', 24900, 'non-veg', true], ['Crispy Paneer Burger', 21900, 'veg', true], ['Double Smash', 32900, 'non-veg', false]]],
    Pizzas: ['Hand-stretched, stone-baked.', [['Margherita', 25900, 'veg', true], ['Farmhouse', 31900, 'veg', false], ['Pepperoni', 34900, 'non-veg', false]]],
    Bowls: ['Fresh, filling and balanced.', [['Teriyaki Chicken Bowl', 28900, 'non-veg', false], ['Garden Grain Bowl', 24900, 'veg', true]]],
    Sides: ['Little extras worth ordering.', [['Peri Peri Fries', 12900, 'veg', false], ['Garlic Bread', 11900, 'veg', false]]],
    Drinks: ['Cold, crisp and refreshing.', [['Fresh Lime Soda', 7900, 'veg', false], ['Cold Coffee', 11900, 'veg', true]]],
  };
  let order = 0;
  for (const [name, [description, items]] of Object.entries(menu)) {
    const cat = await Category.create({ name, slug: slugify(name), description, sortOrder: order++ });
    for (const [pn, price, foodType, featured] of items) {
      const p = await Product.create({ name: pn, slug: slugify(pn), description: `${pn} — freshly prepared at ARAN.co.`, categoryId: cat._id, pricePaise: price, foodType, isFeatured: featured, preparationTime: 15 });
      if (pn === 'Double Smash') { p.stockManaged = true; await p.save(); await Inventory.create({ productId: p._id, availableQuantity: 20 }); }
    }
  }
  await Coupon.create({ code: 'WELCOME10', description: '10% off your order (max ₹100)', discountType: 'percentage', value: 10, minOrderPaise: 20000, maxDiscountPaise: 10000 });
  console.log('[seed] starter menu created');
}

if (require.main === module) {
  const mongoose = require('mongoose');
  if (config.mongoUri.startsWith('mongodb+srv://') && !config.isProd && !config.isTest) {
    require('dns').setServers(['8.8.8.8', '1.1.1.1']);
  }
  mongoose.connect(config.mongoUri).then(seed).then(() => mongoose.disconnect()).catch((e) => { console.error(e); process.exit(1); });
}
module.exports = { seed };
