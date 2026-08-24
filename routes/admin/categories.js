const express = require('express');
const router = express.Router();
const Category = require('../../models/Category');
const Subcategory = require('../../models/Subcategory');
const Product = require('../../models/Product');
const { escapeRegex } = require('../../utils/validation');

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
router.post('/', async (req, res) => {
  try {
    const features = (req.body.features || '')
      .split('\n')
      .map(f => f.trim())
      .filter(f => f.length > 0);

    await Category.create({
      name: req.body.name,
      description: req.body.description,
      type: req.body.type || 'product',
      icon: req.body.icon || 'fa-cogs',
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
router.post('/edit/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.redirect('/admin/categories');
    }
    const features = (req.body.features || '')
      .split('\n')
      .map(f => f.trim())
      .filter(f => f.length > 0);

    category.set({
      name: req.body.name,
      description: req.body.description,
      type: req.body.type || 'product',
      icon: req.body.icon || 'fa-cogs',
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
