const express = require('express');
const router = express.Router();
const Category = require('../../models/Category');
const Subcategory = require('../../models/Subcategory');
const Product = require('../../models/Product');
const { escapeRegex } = require('../../utils/validation');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = process.env.NODE_ENV === 'production' ? '/tmp' : './public/uploads/categories';
    if (process.env.NODE_ENV !== 'production' && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname).toLowerCase());
  }
});

const ALLOWED_IMAGE_EXT = /\.(jpe?g|png|gif|webp|svg|bmp|tiff?|ico|avif|heic|heif)$/i;
const ALLOWED_IMAGE_MIME = /^image\//i;

const upload = multer({
  storage: storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const extOk = ALLOWED_IMAGE_EXT.test(path.extname(file.originalname));
    const mimeOk = ALLOWED_IMAGE_MIME.test(file.mimetype);
    if (extOk || mimeOk) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed (jpg, png, gif, webp, svg...).'));
  }
});

function handleUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    req.flash('error', `Upload failed: ${err.message}`);
    return res.redirect(req.headers.referer || '/admin/categories');
  }
  if (err) {
    req.flash('error', err.message || 'Invalid image upload.');
    return res.redirect(req.headers.referer || '/admin/categories');
  }
  next();
}

async function optimizeUploadedImage(file) {
  const ext = path.extname(file.filename).toLowerCase();
  if (ext === '.svg' || ext === '.gif') {
    return `/uploads/categories/${file.filename}`;
  }
  const optimizedName = file.filename.slice(0, -ext.length) + '.webp';
  const optimizedPath = path.join(path.dirname(file.path), optimizedName);
  await sharp(file.path)
    .resize({ width: 800, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(optimizedPath);
  fs.unlinkSync(file.path);
  return `/uploads/categories/${optimizedName}`;
}

// List all categories
router.get('/', async (req, res) => {
  try {
    let query = {};
    let search = req.query.search;
    if (search) {
      query.name = { $regex: escapeRegex(search), $options: 'i' };
    }
    const categories = await Category.find(query).sort('name');

    // Two aggregate queries instead of 2 queries per category (N+1).
    const [subCounts, productCounts] = await Promise.all([
      Subcategory.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
      Product.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }])
    ]);
    const counts = {};
    categories.forEach(cat => { counts[cat._id] = { subcategories: 0, products: 0 }; });
    subCounts.forEach(sc => { if (counts[sc._id]) counts[sc._id].subcategories = sc.count; });
    productCounts.forEach(pc => { if (counts[pc._id]) counts[pc._id].products = pc.count; });

    res.render('admin/categories/index', { title: 'Manage Categories', categories, counts, search });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// New Category Form
router.get('/new', (req, res) => {
  res.render('admin/categories/new', { title: 'Add New Category' });
});

// Create Category
router.post('/', upload.single('image'), handleUploadError, async (req, res) => {
  try {
    const features = (req.body.features || '')
      .split('\n')
      .map(f => f.trim())
      .filter(f => f.length > 0);

    let imagePath = '';
    if (req.file && req.body.type === 'service') {
      try {
        imagePath = await optimizeUploadedImage(req.file);
      } catch (e) {
        console.error('Image optimization failed:', e);
      }
    }

    await Category.create({
      name: req.body.name,
      description: req.body.description,
      type: req.body.type || 'product',
      icon: req.body.icon || 'fa-cogs',
      image: imagePath,
      features,
      featured: req.body.featured === 'on'
    });
    req.flash('success', 'Category created successfully.');
    res.redirect('/admin/categories');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to create category. Name may already exist.');
    res.redirect('/admin/categories/new');
  }
});

// Edit Category Form
router.get('/edit/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.redirect('/admin/categories');
    }
    res.render('admin/categories/edit', { title: 'Edit Category', category });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Category not found.');
    res.redirect('/admin/categories');
  }
});

// Update Category
router.post('/edit/:id', upload.single('image'), handleUploadError, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.redirect('/admin/categories');
    }
    const features = (req.body.features || '')
      .split('\n')
      .map(f => f.trim())
      .filter(f => f.length > 0);

    let imagePath = category.image;
    if (req.file && req.body.type === 'service') {
      try {
        imagePath = await optimizeUploadedImage(req.file);
      } catch (e) {
        console.error('Image optimization failed:', e);
      }
    }

    category.set({
      name: req.body.name,
      description: req.body.description,
      type: req.body.type || 'product',
      icon: req.body.icon || 'fa-cogs',
      image: imagePath,
      features,
      featured: req.body.featured === 'on'
    });
    await category.save();
    req.flash('success', 'Category updated successfully.');
    res.redirect('/admin/categories');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to update category.');
    res.redirect(`/admin/categories/edit/${req.params.id}`);
  }
});

// Delete Category (guarded)
router.post('/delete/:id', async (req, res) => {
  try {
    const subCount = await Subcategory.countDocuments({ category: req.params.id });
    const productCount = await Product.countDocuments({ category: req.params.id });
    if (subCount > 0 || productCount > 0) {
      req.flash('error', `Cannot delete — ${subCount} subcategories and ${productCount} products still reference this category.`);
      return res.redirect('/admin/categories');
    }
    await Category.findByIdAndDelete(req.params.id);
    req.flash('success', 'Category deleted successfully.');
    res.redirect('/admin/categories');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to delete category.');
    res.redirect('/admin/categories');
  }
});

module.exports = router;
