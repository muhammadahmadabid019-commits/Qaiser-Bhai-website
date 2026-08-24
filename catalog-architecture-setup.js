// One-off, idempotent script: extends the catalog architecture with a 9th
// product category and a separate, parallel Services category tree.
//
// Does NOT touch the Product collection in any way (no existing product is
// read, modified, or re-pointed). Safe to re-run: every step checks for
// existing documents before creating anything.
require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('./models/Category');
const Subcategory = require('./models/Subcategory');

const MONGO_URI = process.env.MONGO_URI;

const NEW_PRODUCT_CATEGORY = {
  name: 'CCTV Accessories',
  description: 'Mounting, housing, power and lens accessories for CCTV cameras',
  subcategories: [
    'Camera Mounts & Brackets',
    'Camera Housings & Enclosures',
    'Camera Power Adapters',
    'Junction & Cable Boxes',
    'Lens & Filter Accessories'
  ]
};

const SERVICE_CATEGORIES = [
  { name: 'CCTV Services', description: 'Installation, maintenance and support services for CCTV & surveillance systems' },
  { name: 'Network Services', description: 'Design, installation and configuration services for networking infrastructure' },
  { name: 'Technical Support', description: 'On-site and remote technical support and AMC services' }
];

async function ensureCategory(name, description, type) {
  let category = await Category.findOne({ name });
  if (category) {
    console.log(`Category already exists, skipped: ${name}`);
    return category;
  }
  category = await Category.create({ name, description, type });
  console.log(`Created ${type} category: ${name}`);
  return category;
}

async function ensureSubcategory(name, categoryId) {
  let sub = await Subcategory.findOne({ name, category: categoryId });
  if (sub) {
    console.log(`  Subcategory already exists, skipped: ${name}`);
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

    // Backfill `type: 'product'` on categories created before this field
    // existed. Only ever touches Category documents that are missing the
    // field, so it can never affect anything created after this point.
    const backfilled = await Category.updateMany(
      { type: { $exists: false } },
      { $set: { type: 'product' } }
    );
    console.log(`Backfilled type='product' on ${backfilled.modifiedCount} legacy categories.`);

    // 9th product category
    const accessoriesCategory = await ensureCategory(
      NEW_PRODUCT_CATEGORY.name,
      NEW_PRODUCT_CATEGORY.description,
      'product'
    );
    for (const subName of NEW_PRODUCT_CATEGORY.subcategories) {
      await ensureSubcategory(subName, accessoriesCategory._id);
    }

    // Separate Services category tree (no subcategories requested yet;
    // Subcategory model already supports adding them later without any
    // schema change).
    for (const svc of SERVICE_CATEGORIES) {
      await ensureCategory(svc.name, svc.description, 'service');
    }

    console.log('Catalog architecture setup complete.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
