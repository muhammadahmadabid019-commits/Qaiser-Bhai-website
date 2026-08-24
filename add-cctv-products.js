// One-off, idempotent script: adds lightweight CCTV catalog entries
// (DVR, IP Cameras, Analog Cameras, PoE Switches) under the existing
// "CCTV & Surveillance" category.
//
// These are catalog-skeleton entries only — placeholder price ($1),
// placeholder brand ("TBD"), zero stock (so nothing reads as a real live
// listing), and no keyFeatures/specifications/datasheetUrl. Fill in real
// data later via /admin/products.
//
// Does NOT touch any existing product (in particular, the 12 Hikvision
// NVR products are never read or written by this script). Safe to re-run:
// every category/subcategory/product is created only if it doesn't
// already exist by name.
require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('./models/Category');
const Subcategory = require('./models/Subcategory');
const Product = require('./models/Product');

const MONGO_URI = process.env.MONGO_URI;
const PARENT_CATEGORY_NAME = 'CCTV & Surveillance';

const PLACEHOLDER_DESCRIPTIONS = {
  DVR: 'Digital video recorder for analog CCTV systems. Full specifications coming soon.',
  Camera: 'CCTV camera for surveillance installations. Full specifications coming soon.',
  PoE: 'Power over Ethernet switch for powering IP cameras and network devices. Full specifications coming soon.'
};

// Existing subcategories (DVR, PoE Switches) are reused as-is.
// New, more specific subcategories are added alongside the existing
// generic "IP Cameras" / "Analog Cameras" ones (which are left untouched)
// so no existing taxonomy node is deleted or renamed.
const GROUPS = [
  {
    subcategory: 'DVR',
    image: null,
    descType: 'DVR',
    products: ['4 Channel DVR', '8 Channel DVR', '16 Channel DVR', '32 Channel DVR']
  },
  {
    subcategory: 'Bullet Cameras',
    image: '/images/bullet-camera.png',
    descType: 'Camera',
    products: ['2MP IP Bullet', '4MP IP Bullet', '5MP IP Bullet', '8MP IP Bullet']
  },
  {
    subcategory: 'Dome Cameras',
    image: '/images/dome-camera.png',
    descType: 'Camera',
    products: ['2MP Dome', '4MP Dome', '5MP Dome', '8MP Dome']
  },
  {
    subcategory: 'PTZ Cameras',
    image: null,
    descType: 'Camera',
    products: ['Mini PTZ', 'Speed Dome PTZ', 'Outdoor PTZ']
  },
  {
    subcategory: 'HD-TVI Cameras',
    image: null,
    descType: 'Camera',
    products: ['2MP Analog Camera', '5MP Analog Camera']
  },
  {
    subcategory: 'Analog Dome Cameras',
    image: '/images/dome-camera.png',
    descType: 'Camera',
    products: ['Indoor Dome Camera', 'Outdoor Dome Camera']
  },
  {
    subcategory: 'PoE Switches',
    image: '/images/poe-switch.png',
    descType: 'PoE',
    products: ['4 Port PoE Switch', '8 Port PoE Switch', '16 Port PoE Switch', '24 Port PoE Switch', '48 Port PoE Switch']
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

      for (const name of group.products) {
        const existing = await Product.findOne({ name });
        if (existing) {
          console.log(`  Skipped (already exists): ${name}`);
          skipped++;
          continue;
        }

        await Product.create({
          name,
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
