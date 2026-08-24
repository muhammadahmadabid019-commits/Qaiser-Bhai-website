// One-off, idempotent script: adds lightweight catalog entries for
// HDMI & Display Accessories and CCTV Accessories.
//
// Same convention as previous batches: placeholder price ($1), placeholder
// brand ("TBD"), zero stock, no keyFeatures/specifications/datasheetUrl.
// Fill in real data later via /admin/products.
//
// "1.5 Meter HDMI Cable" is given an explicit slug: slugify() strips the
// ".", so it would otherwise collide with "15 Meter HDMI Cable"'s
// auto-generated slug (both -> "15-meter-hdmi-cable").
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

const PLACEHOLDER_DESCRIPTIONS = {
  HdmiCable: 'HDMI cable for video/audio connections. Full specifications coming soon.',
  VideoAcc: 'Video accessory for HDMI signal distribution/extension. Full specifications coming soon.',
  Mount: 'Mounting accessory for CCTV camera installation. Full specifications coming soon.',
  Protection: 'Protective housing/enclosure for CCTV camera installations. Full specifications coming soon.',
  Storage: 'Surveillance-grade hard drive for DVR/NVR storage. Full specifications coming soon.'
};

const CATEGORIES = [
  {
    category: 'HDMI & Display Accessories',
    groups: [
      {
        // Exact match to an existing subcategory — reused, not duplicated.
        subcategory: 'HDMI Cables',
        descType: 'HdmiCable',
        products: [
          { name: '1.5 Meter HDMI Cable', slug: '1-5-meter-hdmi-cable' },
          { name: '3 Meter HDMI Cable' },
          { name: '5 Meter HDMI Cable' },
          { name: '10 Meter HDMI Cable' },
          { name: '15 Meter HDMI Cable' },
          { name: '20 Meter HDMI Cable' }
        ]
      },
      {
        subcategory: 'Video Accessories',
        descType: 'VideoAcc',
        products: [{ name: 'HDMI Splitter' }, { name: 'HDMI Extender' }, { name: 'HDMI Switch' }]
      }
    ]
  },
  {
    category: 'CCTV Accessories',
    groups: [
      {
        subcategory: 'Camera Mounts',
        descType: 'Mount',
        products: [
          { name: '1 Foot Stand' },
          { name: '2 Foot Stand' },
          { name: '4 Foot Stand' },
          { name: 'Wall Mount Bracket' },
          { name: 'Pole Mount Bracket' },
          { name: 'Pole Clamp' }
        ]
      },
      {
        subcategory: 'Camera Protection',
        descType: 'Protection',
        products: [{ name: 'Weatherproof Junction Box' }, { name: 'Outdoor Housing' }]
      },
      {
        subcategory: 'Storage',
        descType: 'Storage',
        products: [
          { name: 'Surveillance HDD 1TB' },
          { name: 'Surveillance HDD 2TB' },
          { name: 'Surveillance HDD 4TB' },
          { name: 'Surveillance HDD 8TB' },
          { name: 'Surveillance HDD 10TB' }
        ]
      }
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

    let created = 0;
    let skipped = 0;

    for (const catDef of CATEGORIES) {
      const parentCategory = await Category.findOne({ name: catDef.category, type: 'product' });
      if (!parentCategory) {
        throw new Error(`Category "${catDef.category}" not found — run catalog-architecture-setup.js first.`);
      }

      console.log(`\n=== ${catDef.category} ===`);

      for (const group of catDef.groups) {
        console.log(`\n${group.subcategory}:`);
        const subcategory = await ensureSubcategory(group.subcategory, parentCategory._id);

        for (const item of group.products) {
          const existing = await Product.findOne({ name: item.name });
          if (existing) {
            console.log(`  Skipped (already exists): ${item.name}`);
            skipped++;
            continue;
          }

          await Product.create({
            name: item.name,
            slug: item.slug,
            description: `${item.name} — ${PLACEHOLDER_DESCRIPTIONS[group.descType]}`,
            price: 1,
            brand: 'TBD',
            category: parentCategory._id,
            subcategory: subcategory._id,
            stock: 0
          });
          console.log(`  Added: ${item.name}`);
          created++;
        }
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
