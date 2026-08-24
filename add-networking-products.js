// One-off, idempotent script: adds lightweight Networking Equipment catalog
// entries (Switches, Routers, Wireless, Fiber Optic) under the existing
// "Networking Equipment" category.
//
// Same convention as add-cctv-products.js: placeholder price ($1),
// placeholder brand ("TBD"), zero stock, no keyFeatures/specifications/
// datasheetUrl. Fill in real data later via /admin/products.
//
// Does NOT touch any existing product. Safe to re-run: every
// category/subcategory/product is created only if it doesn't already
// exist by name.
require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('./models/Category');
const Subcategory = require('./models/Subcategory');
const Product = require('./models/Product');

const MONGO_URI = process.env.MONGO_URI;
const PARENT_CATEGORY_NAME = 'Networking Equipment';

const PLACEHOLDER_DESCRIPTIONS = {
  Switch: 'Network switch for LAN connectivity. Full specifications coming soon.',
  Router: 'Router for network connectivity and routing. Full specifications coming soon.',
  AccessPoint: 'Wireless access point for WiFi network coverage. Full specifications coming soon.',
  Bridge: 'Wireless bridge for point-to-point/multipoint network links. Full specifications coming soon.',
  Fiber: 'Fiber optic networking component. Full specifications coming soon.'
};

// "Routers" and "Access Points" match existing subcategories exactly and are
// reused as-is. Everything else is added as a new, more specific
// subcategory alongside the existing generic "Switches" / "Fiber Equipment"
// ones (left untouched) — same non-destructive pattern as the CCTV batch.
const GROUPS = [
  {
    subcategory: 'Unmanaged Switches',
    image: null,
    descType: 'Switch',
    products: ['5 Port Unmanaged Switch', '8 Port Unmanaged Switch', '16 Port Unmanaged Switch', '24 Port Unmanaged Switch', '48 Port Unmanaged Switch']
  },
  {
    subcategory: 'Managed Switches',
    image: null,
    descType: 'Switch',
    products: ['Layer 2 Switch', 'Layer 3 Switch', 'Smart Switch']
  },
  {
    subcategory: 'Routers',
    image: '/images/wifi-router.png',
    descType: 'Router',
    products: ['Home Router', 'Business Router', 'VPN Router', 'Multi-WAN Router']
  },
  {
    subcategory: 'Access Points',
    image: null,
    descType: 'AccessPoint',
    products: ['Indoor Access Point', 'Outdoor Access Point', 'Ceiling Mount AP']
  },
  {
    subcategory: 'Wireless Bridges',
    image: null,
    descType: 'Bridge',
    products: ['Point-to-Point Bridge', 'Point-to-Multipoint Bridge']
  },
  {
    subcategory: 'Fiber Optic Networking',
    image: null,
    descType: 'Fiber',
    // "SFP+ Module" is given an explicit slug: slugify() strips the "+",
    // so it would otherwise collide with "SFP Module"'s auto-generated slug.
    products: [
      'SFP Module',
      { name: 'SFP+ Module', slug: 'sfp-plus-module' },
      'Media Converter',
      'Fiber Patch Cord',
      'Fiber Distribution Box',
      'Fiber Termination Box'
    ]
  }
];

async function ensureSubcategory(name, categoryId) {
  let sub = await Subcategory.findOne({ name, category: categoryId });
  if (sub) {
    console.log(`  Subcategory already exists, reusing: ${name}`);
    return sub;
  }
  sub = await Subcategory.create({ name, category: categoryId });
  console.log(`  Created subcategory: ${name}`);
  return sub;
}

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to DB...');

    const parentCategory = await Category.findOne({ name: PARENT_CATEGORY_NAME, type: 'product' });
    if (!parentCategory) {
      throw new Error(`Category "${PARENT_CATEGORY_NAME}" not found — run catalog-architecture-setup.js first.`);
    }

    let created = 0;
    let skipped = 0;

    for (const group of GROUPS) {
      console.log(`\n${group.subcategory}:`);
      const subcategory = await ensureSubcategory(group.subcategory, parentCategory._id);

      for (const entry of group.products) {
        const name = typeof entry === 'string' ? entry : entry.name;
        const explicitSlug = typeof entry === 'string' ? undefined : entry.slug;

        const existing = await Product.findOne({ name });
        if (existing) {
          console.log(`  Skipped (already exists): ${name}`);
          skipped++;
          continue;
        }

        await Product.create({
          name,
          slug: explicitSlug,
          description: `${name} — ${PLACEHOLDER_DESCRIPTIONS[group.descType]}`,
          price: 1,
          brand: 'TBD',
          category: parentCategory._id,
          subcategory: subcategory._id,
          stock: 0,
          image: group.image || undefined
        });
        console.log(`  Added: ${name}`);
        created++;
      }
    }

    console.log(`\nDone. Created ${created} products, skipped ${skipped} already-existing.`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
