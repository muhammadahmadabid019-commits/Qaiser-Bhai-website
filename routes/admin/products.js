const express = require('express');
const router = express.Router();
const Product = require('../../models/Product');
const Category = require('../../models/Category');
const Subcategory = require('../../models/Subcategory');
const slugify = require('slugify');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { escapeRegex } = require('../../utils/validation');

// Multer Configuration
//
// NOTE on production storage: on serverless hosts (this project ships a
// vercel.json), /tmp is the only writable path but it is ephemeral — files
// written here do not survive past the current invocation/instance and
// disappear on redeploy. Uploaded product images (and payment receipts,
// see routes/admin/orders.js) will not persist reliably in that
// environment. Fixing this properly means moving to persistent object
// storage (S3 / Cloudinary / Vercel Blob), which needs its own account and
// credentials from whoever owns the deployment — flagging it here rather
// than wiring in a specific provider unasked. Running the app on a normal
// long-lived Node host (not serverless) does not have this problem, since
// ./public/uploads/products is a real persistent path there.
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = process.env.NODE_ENV === 'production' ? '/tmp' : './public/uploads/products';
    if (process.env.NODE_ENV !== 'production' && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname).toLowerCase());
  }
});

// Accepts any common image format/extension (not just jpeg/png/gif/webp)
// so admins can upload straight from a phone or camera without converting
// first. Still an allowlist of real image types, not "any file" — accepting
// arbitrary extensions would open a file-upload vulnerability (e.g. .php).
const ALLOWED_IMAGE_EXT = /\.(jpe?g|png|gif|webp|svg|bmp|tiff?|ico|avif|heic|heif)$/i;
const ALLOWED_IMAGE_MIME = /^image\//i;

const upload = multer({
  storage: storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    // Some browsers/phones send a generic or missing mimetype for less
    // common formats (HEIC, AVIF); accept on a matching extension OR a
    // real image/* mimetype rather than requiring both.
    const extOk = ALLOWED_IMAGE_EXT.test(path.extname(file.originalname));
    const mimeOk = ALLOWED_IMAGE_MIME.test(file.mimetype);
    if (extOk || mimeOk) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed (jpg, png, gif, webp, svg, bmp, tiff, avif, heic...).'));
  }
});

// Turns a multer error (or the fileFilter's rejection) into a flash message
// and a redirect back to the form, instead of crashing the request.
function handleUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'Image is too large (max 8MB).'
      : `Upload failed: ${err.message}`;
    req.flash('error', message);
    return res.redirect(req.headers.referer || '/admin/products');
  }
  if (err) {
    req.flash('error', err.message || 'Invalid image upload.');
    return res.redirect(req.headers.referer || '/admin/products');
  }
  next();
}

// Resizes and compresses an uploaded product image so the site doesn't
// serve full-resolution phone/camera photos (the main cause of slow page
// loads — see the public/uploads audit). SVG (vector) and GIF (possibly
// animated) are left untouched; everything else is converted to WebP.
async function optimizeUploadedImage(file) {
  const ext = path.extname(file.filename).toLowerCase();
  if (ext === '.svg' || ext === '.gif') {
    return `/uploads/products/${file.filename}`;
  }

  const optimizedName = file.filename.slice(0, -ext.length) + '.webp';
  const optimizedPath = path.join(path.dirname(file.path), optimizedName);
  await sharp(file.path)
    .resize({ width: 1200, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(optimizedPath);
  fs.unlinkSync(file.path);
  return `/uploads/products/${optimizedName}`;
}

// Parse the freeform textarea fields (Key Features, Specifications) into structured data
function parseProductBody(body) {
  return {
    name: body.name,
    description: body.description,
    price: body.price,
    previousPrice: body.previousPrice,
    category: body.category,
    subcategory: body.subcategory || null,
    brand: body.brand,
    datasheetUrl: body.datasheetUrl,
    rating: body.rating,
    stock: body.stock,
    keyFeatures: (body.keyFeatures || '')
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean),
    specifications: (body.specifications || '')
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const idx = line.indexOf(':');
        if (idx === -1) return null;
        return { label: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
      })
      .filter(spec => spec && spec.label && spec.value)
  };
}

// List all products (Dashboard view)
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 25;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    let query = {};
    if (search) {
      const safeSearch = escapeRegex(search);
      query = {
        $or: [
          { name: { $regex: safeSearch, $options: 'i' } },
          { brand: { $regex: safeSearch, $options: 'i' } }
        ]
      };
    }

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);

    const products = await Product.find(query)
      .populate('category')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit);

    res.render('admin/products/index', {
      title: 'Manage Products',
      products,
      search,
      currentPage: page,
      totalPages
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// New Product Form
router.get('/new', async (req, res) => {
  try {
    const categories = await Category.find({ type: 'product' }).sort('name');
    const subcategories = await Subcategory.find().sort('name');
    res.render('admin/products/new', { title: 'Add New Product', categories, subcategories });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// Create Product
router.post('/', upload.single('image'), handleUploadError, async (req, res) => {
  try {
    const productData = parseProductBody(req.body);
    if (req.file) {
      productData.image = await optimizeUploadedImage(req.file);
    }

    try {
      await Product.create(productData);
    } catch (err) {
      // Retry once with a disambiguated slug if the auto-generated slug collides
      if (err.code === 11000 && err.keyPattern && err.keyPattern.slug) {
        productData.slug = `${slugify(productData.name, { lower: true, strict: true })}-${Date.now().toString(36)}`;
        await Product.create(productData);
      } else {
        throw err;
      }
    }

    req.flash('success', 'Product created successfully.');
    res.redirect('/admin/products');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to create product.');
    res.redirect('/admin/products/new');
  }
});

// Edit Product Form
router.get('/edit/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    const categories = await Category.find({ type: 'product' }).sort('name');
    const subcategories = await Subcategory.find().sort('name');
    if (!product) {
      return res.redirect('/admin/products');
    }
    res.render('admin/products/edit', { title: 'Edit Product', product, categories, subcategories });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Product not found.');
    res.redirect('/admin/products');
  }
});

// Update Product
router.post('/edit/:id', upload.single('image'), handleUploadError, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.redirect('/admin/products');
    }

    const updateData = parseProductBody(req.body);

    if (req.file) {
      // Attempt to delete old image if it exists and is local
      if (product.image && product.image.startsWith('/uploads/')) {
        const oldImagePath = path.join(__dirname, '../../public', product.image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      updateData.image = await optimizeUploadedImage(req.file);
    }

    // Use set()+save() (not findByIdAndUpdate) so the pre-save hook regenerates
    // the slug on rename and full schema validation runs on the update.
    product.set(updateData);
    await product.save();

    req.flash('success', 'Product updated successfully.');
    res.redirect('/admin/products');
  } catch (err) {
    console.error(err);
    if (err.code === 11000 && err.keyPattern && err.keyPattern.slug) {
      req.flash('error', 'Another product already has that name/slug. Please use a different name.');
    } else {
      req.flash('error', 'Failed to update product.');
    }
    res.redirect(`/admin/products/edit/${req.params.id}`);
  }
});

// Delete Product
router.post('/delete/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (product && product.image && product.image.startsWith('/uploads/')) {
      const imagePath = path.join(__dirname, '../../public', product.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
    await Product.findByIdAndDelete(req.params.id);
    req.flash('success', 'Product deleted successfully.');
    res.redirect('/admin/products');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to delete product.');
    res.redirect('/admin/products');
  }
});

module.exports = router;
