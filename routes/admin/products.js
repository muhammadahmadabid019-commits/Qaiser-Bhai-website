const express = require('express');
const router = express.Router();
const Product = require('../../models/Product');
const Category = require('../../models/Category');
const Subcategory = require('../../models/Subcategory');
const slugify = require('slugify');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer Configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = process.env.NODE_ENV === 'production' ? '/tmp' : './public/uploads/products';
    if (process.env.NODE_ENV !== 'production' && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5000000 },
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb('Error: Images Only!');
    }
  }
});

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
      query = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { brand: { $regex: search, $options: 'i' } }
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
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const productData = parseProductBody(req.body);
    if (req.file) {
      productData.image = `/uploads/products/${req.file.filename}`;
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
    res.status(500).send('Server Error');
  }
});

// Update Product
router.post('/edit/:id', upload.single('image'), async (req, res) => {
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
      updateData.image = `/uploads/products/${req.file.filename}`;
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
