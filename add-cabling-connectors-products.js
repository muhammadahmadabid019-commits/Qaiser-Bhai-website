// One-off, idempotent script: adds lightweight catalog entries for
// Structured Cabling and Connectors & Accessories.
//
// Same convention as the previous batches: placeholder price ($1),
// placeholder brand ("TBD"), zero stock, no keyFeatures/specifications/
// datasheetUrl. Fill in real data later via /admin/products.
//
// Does NOT touch any existing product. Safe to re-run: every
// category/subcategory/product is created only if it doesn't already
// exist by name — this also means "Fiber Patch Cord" is intentionally
// skipped here, since it already exists under Networking Equipment ->
// Fiber Optic Networking (added in the previous batch). See the summary
// printed at the end.
require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('./models/Category');
const Subcategory = require('./models/Subcategory');
const Product = require('./models/Product');

const MONGO_URI = process.env.MONGO_URI;

const PLACEHOLDER_DESCRIPTIONS = {
  Cable: 'Structured cabling for data/voice network installations. Full specifications coming soon.',
  PatchCord: 'Pre-terminated patch cord for network connections. Full specifications coming soon.',
  Connector: 'Connector for cabling and CCTV installations. Full specifications coming soon.',
  Keystone: 'Keystone jack for structured cabling faceplates and patch panels. Full specifications coming soon.',
  Faceplate: 'Faceplate / back box for cable termination and mounting. Full specifications coming soon.'
};

// Category name -> list of subcategory groups. Where a group's name
// doesn't exactly match an existing subcategory, a new one is created
// alongside the existing (now-legacy, still-empty) one — same
// non-destructive pattern as the CCTV and Networking Equipment batches.
const CATEGORIES = [
  {
    category: 'Structured Cabling',
    groups: [
      {
        subcategory: 'UTP Cables',
        descType: 'Cable',
        products: [
          { name: 'CAT5e Cable' },
          { name: 'CAT6 Cable', image: '/images/cat6-cable.png' },
          { name: 'CAT6A Cable' },
          { name: 'CAT7 Cable' }
        ]
      },
      {
        subcategory: 'Fiber Cables',
        descType: 'Cable',
        products: [{ name: 'Single Mode Fiber' }, { name: 'Multi Mode Fiber' }]
      },
      {
        subcategory: 'Coaxial Cables',
        descType: 'Cable',
        products: [{ name: 'RG59 Cable' }, { name: 'RG6 Cable' }]
      },
      {
        subcategory: 'Patch Cords',
        descType: 'PatchCord',
        products: [
          { name: 'CAT6 Patch Cord' },
          { name: 'CAT6A Patch Cord' },
          { name: 'Fiber Patch Cord' } // expected skip — see header comment
        ]
      }
    ]
  },
  {
    category: 'Connectors & Accessories',
    groups: [
      {
        subcategory: 'RJ45 Connectors',
        descType: 'Connector',
        products: [{ name: 'UTP RJ45 Connector' }, { name: 'STP RJ45 Connector' }, { name: 'FTP RJ45 Connector' }]
      },
      {
        subcategory: 'CCTV Connectors',
        descType: 'Connector',
        products: [
          { name: 'BNC Connector' },
          { name: 'DC Male Connector' },
          { name: 'DC Female Connector' },
          { name: 'Video Balun' }
        ]
      },
      {
        subcategory: 'Keystone Jacks',
        descType: 'Keystone',
        products: [{ name: 'CAT5e Keystone' }, { name: 'CAT6 Keystone' }, { name: 'CAT6A Keystone' }]
      },
      {
        subcategory: 'Faceplates & Back Boxes',
        descType: 'Faceplate',
        products: [
          { name: 'Single Port Faceplate' },
          { name: 'Dual Port Faceplate' },
          { name: '4x4 Camera Junction Box' }
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
    const skippedNames = [];

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
            skippedNames.push(item.name);
            continue;
          }

          await Product.create({
            name: item.name,
            description: `${item.name} — ${PLACEHOLDER_DESCRIPTIONS[group.descType]}`,
            price: 1,
            brand: 'TBD',
            category: parentCategory._id,
            subcategory: subcategory._id,
            stock: 0,
            image: item.image || undefined
          });
          console.log(`  Added: ${item.name}`);
          created++;
        }
      }
    }

    console.log(`\nDone. Created ${created} products, skipped ${skipped} already-existing (${skippedNames.join(', ')}).`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
