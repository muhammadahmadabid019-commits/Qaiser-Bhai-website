// One-time migration: resizes/compresses the product photos that were
// uploaded before routes/admin/products.js started auto-optimizing new
// uploads on the way in (see optimizeUploadedImage() there). Many of these
// were full-resolution phone/camera exports (500KB-1.3MB each), which is
// the single biggest contributor to slow page loads on this site.
//
// Safe to re-run: already-optimized (small, .webp) files are skipped.
require('dotenv').config();
const mongoose = require('mongoose');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const Product = require('./models/Product');

const PRODUCTS_DIR = path.join(__dirname, 'public/uploads/products');
const SMALL_ENOUGH_BYTES = 150 * 1024;

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const products = await Product.find({ image: { $regex: '^/uploads/products/' } });
  console.log(`Found ${products.length} products referencing local uploaded images.`);

  // filename -> resulting filename, so products that happen to share an
  // image (or get visited twice) don't get double-processed.
  const renameMap = new Map();
  let optimized = 0, skipped = 0, missing = 0, savedBytes = 0;

  for (const product of products) {
    const filename = path.basename(product.image);
    let newFilename = renameMap.get(filename);

    if (newFilename === undefined) {
      const srcPath = path.join(PRODUCTS_DIR, filename);
      const ext = path.extname(filename).toLowerCase();

      if (!fs.existsSync(srcPath)) {
        missing++;
        renameMap.set(filename, filename);
        continue;
      }

      if (ext === '.svg' || ext === '.gif') {
        skipped++;
        renameMap.set(filename, filename);
        continue;
      }

      const originalSize = fs.statSync(srcPath).size;
      if (ext === '.webp' && originalSize < SMALL_ENOUGH_BYTES) {
        skipped++;
        renameMap.set(filename, filename);
        continue;
      }

      const candidateName = filename.slice(0, -ext.length) + '.webp';
      const candidatePath = path.join(PRODUCTS_DIR, candidateName);
      const tmpPath = candidatePath + '.tmp';

      try {
        await sharp(srcPath).resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 82 }).toFile(tmpPath);
        fs.renameSync(tmpPath, candidatePath);
        if (candidatePath !== srcPath) fs.unlinkSync(srcPath);

        const newSize = fs.statSync(candidatePath).size;
        savedBytes += (originalSize - newSize);
        newFilename = candidateName;
        optimized++;
      } catch (err) {
        console.error(`Failed to optimize ${filename}: ${err.message}`);
        newFilename = filename;
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      }

      renameMap.set(filename, newFilename);
    }

    if (newFilename !== filename) {
      product.image = `/uploads/products/${newFilename}`;
      await product.save();
    }
  }

  console.log({ optimized, skipped, missing, savedMB: (savedBytes / 1024 / 1024).toFixed(2) });
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
