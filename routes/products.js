const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Category = require('../models/Category');
const Subcategory = require('../models/Subcategory');

// Priority ordering for customer-facing product catalog:
// Priority 1: Main Products (CCTV, Networking, Racks, Power)
// Priority 2: Infrastructure / Supporting Products (Cabling, Tools)
// Priority 3: Accessories (CCTV Accessories, Connectors, HDMI)
const CATEGORY_PRIORITY = {
  'CCTV & Surveillance': 1,
  'Networking Equipment': 2,
  'Racks & Cabinets': 3,
  'Power Solutions': 4,
  'Structured Cabling': 5,
  'Installation Tools': 6,
  'CCTV Accessories': 7,
  'Connectors & Accessories': 8,
  'HDMI & Display Accessories': 9
};

function getCategoryPriority(product) {
  if (!product.category || !product.category.name) return 99;
  return CATEGORY_PRIORITY[product.category.name] || 99;
}

router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 8;
    const skip = (page - 1) * limit;

    // Build the query object for filtering
    const query = {};

    // Search by name
    if (req.query.search) {
      query.name = { $regex: req.query.search, $options: 'i' };
    }

    // Filter by category
    if (req.query.category && req.query.category !== '') {
      query.category = req.query.category;
    }

    // Filter by subcategory
    if (req.query.subcategory && req.query.subcategory !== '') {
      query.subcategory = req.query.subcategory;
    }

    // Filter by price range
    if (req.query.minPrice || req.query.maxPrice) {
      query.price = {};
      if (req.query.minPrice) query.price.$gte = Number(req.query.minPrice);
      if (req.query.maxPrice) query.price.$lte = Number(req.query.maxPrice);
    }

    const allProducts = await Product.find(query)
      .populate('category')
      .populate('subcategory')
      .sort('-createdAt');

    // Sort matching products by category priority first, then preserve existing
    // order (newest first: -createdAt) within each category.
    allProducts.sort((a, b) => {
      const prioA = getCategoryPriority(a);
      const prioB = getCategoryPriority(b);
      if (prioA !== prioB) {
        return prioA - prioB;
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    const totalProducts = allProducts.length;
    const totalPages = Math.ceil(totalProducts / limit);
    const products = allProducts.slice(skip, skip + limit);

    const categories = await Category.find({ type: 'product' }).sort('name');
    const subcategories = await Subcategory.find().sort('name');

    res.render('products', {
      title: 'Our Products - unieQ Solutions',
      products,
      categories,
      subcategories,
      currentPage: page,
      totalPages,
      query: req.query, // Pass query params back to the view to maintain filter state
      currentUrl: req.originalUrl
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Product detail page (slug-based)
router.get('/:slug', async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug })
      .populate('category')
      .populate('subcategory');

    if (!product) {
      return res.status(404).render('404', { title: '404 - Product Not Found' });
    }

    let relatedProducts = [];
    if (product.subcategory) {
      relatedProducts = await Product.find({
        _id: { $ne: product._id },
        subcategory: product.subcategory._id
      }).populate('category').populate('subcategory').limit(4);
    }
    if (relatedProducts.length < 4) {
      const existingIds = relatedProducts.map(p => p._id).concat(product._id);
      const fallback = await Product.find({
        _id: { $nin: existingIds },
        category: product.category._id
      }).populate('category').populate('subcategory').limit(4 - relatedProducts.length);
      relatedProducts = relatedProducts.concat(fallback);
    }

    res.render('product-detail', {
      title: `${product.name} - unieQ Solutions`,
      product,
      relatedProducts,
      returnTo: req.query.returnTo || '/products'
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
