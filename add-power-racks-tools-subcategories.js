// One-off, idempotent script: adds new subcategories under Power
// Solutions, Racks & Cabinets, and Installation Tools.
//
// Per user confirmation, these are catalog-taxonomy entries (Subcategory
// documents) only — no Product documents are created in this pass;
// specific SKUs under each will follow in a later batch, same as every
// other category so far.
//
// Does NOT touch the Product collection at all. Safe to re-run: every
// subcategory is created only if it doesn't already exist by name under
// its category. "Rack Accessories" is an exact match to an existing
// subcategory and is reused rather than duplicated.
require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('./models/Category');
const Subcategory = require('./models/Subcategory');

const MONGO_URI = process.env.MONGO_URI;

const CATEGORIES = [
  {
    category: 'Power Solutions',
    subcategories: ['CCTV Power Supplies', 'Power Adapters', 'PoE Equipment', 'UPS Systems']
  },
  {
    category: 'Racks & Cabinets',
    subcategories: ['Network Racks', 'Rack Accessories']
  },
  {
    category: 'Installation Tools',
    subcategories: ['Networking Tools', 'Fiber Tools', 'CCTV Tools']
  }
];

async function ensureSubcategory(name, categoryId) {
  const existing = await Subcategory.findOne({ name, category: categoryId });
  if (existing) {
    console.log(`  Already exists, reused: ${name}`);
    return existing;
  }
  await Subcategory.create({ name, category: categoryId });
  console.log(`  Created: ${name}`);
}

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to DB...');

    for (const catDef of CATEGORIES) {
      const category = await Category.findOne({ name: catDef.category, type: 'product' });
      if (!category) {
        throw new Error(`Category "${catDef.category}" not found — run catalog-architecture-setup.js first.`);
      }

      console.log(`\n${catDef.category}:`);
      for (const subName of catDef.subcategories) {
        await ensureSubcategory(subName, category._id);
      }
    }

    console.log('\nDone.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
