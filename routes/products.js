const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Subcategory = require('../models/Subcategory');
const { escapeRegex } = require('../utils/validation');

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

// $switch branches mirroring CATEGORY_PRIORITY, for sorting server-side
// (aggregation) instead of loading every matching product into memory.
const CATEGORY_PRIORITY_SWITCH = {
  branches: Object.entries(CATEGORY_PRIORITY).map(([name, priority]) => ({
    case: { $eq: ['$category.name', name] },
    then: priority
  })),
  default: 99
};

// The category / subcategory lists change very rarely (admin edits only) but
// are needed on every catalog page load — and now on every keystroke of the
// live filter. Cache them in-process for a few minutes so the common case is
// two DB queries (count + product aggregate) instead of four.
const TAXONOMY_TTL_MS = 5 * 60 * 1000;
let _taxonomyCache = { at: 0, categories: null, subcategories: null };

async function getTaxonomy() {
  const now = Date.now();
  if (_taxonomyCache.categories && now - _taxonomyCache.at < TAXONOMY_TTL_MS) {
    return _taxonomyCache;
  }
  const [categories, subcategories] = await Promise.all([
    Category.find({ type: 'product' }).sort('name').lean(),
    Subcategory.find().sort('name').lean()
  ]);
  _taxonomyCache = { at: now, categories, subcategories };
  return _taxonomyCache;
}

router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 8;
    const skip = (page - 1) * limit;

    // Build the match stage for filtering
    const matchStage = {};

    // Search by name
    if (req.query.search) {
      matchStage.name = { $regex: escapeRegex(req.query.search), $options: 'i' };
    }

    // Filter by category
    if (req.query.category && req.query.category !== '' && mongoose.isValidObjectId(req.query.category)) {
      matchStage.category = new mongoose.Types.ObjectId(req.query.category);
    }

    // Filter by subcategory
    if (req.query.subcategory && req.query.subcategory !== '' && mongoose.isValidObjectId(req.query.subcategory)) {
      matchStage.subcategory = new mongoose.Types.ObjectId(req.query.subcategory);
    }

    // Filter by price range — ignore anything that isn't a valid,
    // non-negative number so a stray "abc" can't turn into a `$gte: NaN`
    // cast error (500).
    const minPrice = Number(req.query.minPrice);
    const maxPrice = Number(req.query.maxPrice);
    const hasMin = req.query.minPrice != null && req.query.minPrice !== '' && Number.isFinite(minPrice) && minPrice >= 0;
    const hasMax = req.query.maxPrice != null && req.query.maxPrice !== '' && Number.isFinite(maxPrice) && maxPrice >= 0;
    if (hasMin || hasMax) {
      matchStage.price = {};
      if (hasMin) matchStage.price.$gte = minPrice;
      if (hasMax) matchStage.price.$lte = maxPrice;
    }

    const totalProducts = await Product.countDocuments(matchStage);
    const totalPages = Math.ceil(totalProducts / limit);

    // Sort matching products by category priority first, then newest first
    // within each category — done in the DB via aggregation + $skip/$limit
    // instead of loading the full matching set into Node and slicing it.
    const products = await Product.aggregate([
      { $match: matchStage },
      { $lookup: { from: 'categories', localField: 'category', foreignField: '_id', as: 'category' } },
      { $unwind: '$category' },
      { $lookup: { from: 'subcategories', localField: 'subcategory', foreignField: '_id', as: 'subcategory' } },
      { $unwind: { path: '$subcategory', preserveNullAndEmptyArrays: true } },
      { $addFields: { categoryPriority: { $switch: CATEGORY_PRIORITY_SWITCH } } },
      { $sort: { categoryPriority: 1, createdAt: -1 } },
      { $skip: skip },
      { $limit: limit }
    ]);

    // Query params echoed back to the view for filter state + pagination
    // links. Strip the transport-only `partial` flag so it never leaks into
    // the address bar or a pagination href.
    const viewQuery = { ...req.query };
    delete viewQuery.partial;
    const cleanQs = new URLSearchParams(viewQuery).toString();
    const currentUrl = '/products' + (cleanQs ? '?' + cleanQs : '');

    // Live filter / pagination: return just the results fragment.
    if (req.query.partial === '1') {
      return res.render('partials/product-results', {
        layout: false,
        products,
        totalPages,
        currentPage: page,
        query: viewQuery,
        currentUrl
      });
    }

    const { categories, subcategories } = await getTaxonomy();

    res.render('products', {
      title: 'Our Products - unieQ Solutions',
      products,
      categories,
      subcategories,
      currentPage: page,
      totalPages,
      query: viewQuery, // Pass query params back to the view to maintain filter state
      currentUrl
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
