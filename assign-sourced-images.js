// One-off script: optimizes the 7 real product photos sourced from
// manufacturer/retailer sites during this pass (for the products whose
// image file was missing from disk) and assigns them to their products.
require('dotenv').config();
const mongoose = require('mongoose');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const Product = require('./models/Product');

const PRODUCTS_DIR = path.join(__dirname, 'public/uploads/products');

const ASSIGNMENTS = [
  { productName: 'TL-SG1005D 5-Port Gigabit Desktop Switch', sourceFile: 'scratch_tl-sg1005d.jpg' },
  { productName: 'DS-2CV2U01EFD-IW (1MP Mini IP/WiFi Camera)', sourceFile: 'scratch_ds2cv2u01efd_cropped.png' },
  { productName: 'Cube 2MP WiFi Indoor Camera', sourceFile: 'scratch_imou_cube.jpg' },
  { productName: 'GPON ONU/ONT Router (Fiber Terminal)', sourceFile: 'scratch_huawei_ont.png' },
  { productName: '42U wall-mount network rack', sourceFile: 'scratch_rack42u.webp' },
  { productName: '27U 4-Post Open Frame Rack', sourceFile: 'scratch_rack27u.jpg' },
  { productName: 'Fiber Media Converter (SC, Single-Mode, 20km)', sourceFile: 'scratch_mediaconv.jpg' }
];

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  let updated = 0;
  for (const { productName, sourceFile } of ASSIGNMENTS) {
    const product = await Product.findOne({ name: productName });
    if (!product) {
      console.warn(`No product found: "${productName}"`);
      continue;
    }

    const sourcePath = path.join(__dirname, sourceFile);
    if (!fs.existsSync(sourcePath)) {
      console.warn(`Source file missing: ${sourceFile}`);
      continue;
    }

    const newFilename = `image-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.webp`;
    const destPath = path.join(PRODUCTS_DIR, newFilename);
    await sharp(sourcePath)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toFile(destPath);

    product.image = `/uploads/products/${newFilename}`;
    await product.save();
    updated++;
    console.log(`Assigned ${newFilename} to "${productName}"`);
  }

  console.log({ updated, total: ASSIGNMENTS.length });
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
