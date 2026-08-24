const express = require('express');
const router = express.Router();
const Category = require('../../models/Category');
const Subcategory = require('../../models/Subcategory');
const Product = require('../../models/Product');

// List all categories
router.get('/', async (req, res) => {
  try {
    let query = {};
    let search = req.query.search;
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    const categories = await Category.find(query).sort('name');
    const counts = {};
    for (const cat of categories) {
      counts[cat._id] = {
        subcategories: await Subcategory.countDocuments({ category: cat._id }),
        products: await Product.countDocuments({ category: cat._id })
      };
    }
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
    res.status(500).send('Server Error');
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
