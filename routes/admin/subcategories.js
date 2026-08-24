const express = require('express');
const router = express.Router();
const Category = require('../../models/Category');
const Subcategory = require('../../models/Subcategory');
const Product = require('../../models/Product');

// List all subcategories
router.get('/', async (req, res) => {
  try {
    let query = {};
    let search = req.query.search;
    
    if (search) {
      const matchingCategories = await Category.find({ name: { $regex: search, $options: 'i' } });
      const categoryIds = matchingCategories.map(cat => cat._id);
      
      query = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { category: { $in: categoryIds } }
        ]
      };
    }

    const subcategories = await Subcategory.find(query).populate('category').sort('name');
    const counts = {};
    for (const sub of subcategories) {
      counts[sub._id] = await Product.countDocuments({ subcategory: sub._id });
    }
    res.render('admin/subcategories/index', { title: 'Manage Subcategories', subcategories, counts, search });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// New Subcategory Form
router.get('/new', async (req, res) => {
  try {
    const categories = await Category.find().sort('name');
    res.render('admin/subcategories/new', { title: 'Add New Subcategory', categories });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// Create Subcategory
router.post('/', async (req, res) => {
  try {
    await Subcategory.create({
      name: req.body.name,
      category: req.body.category,
      description: req.body.description
    });
    req.flash('success', 'Subcategory created successfully.');
    res.redirect('/admin/subcategories');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to create subcategory. Name may already exist under that category.');
    res.redirect('/admin/subcategories/new');
  }
});

// Edit Subcategory Form
router.get('/edit/:id', async (req, res) => {
  try {
    const subcategory = await Subcategory.findById(req.params.id);
    const categories = await Category.find().sort('name');
    if (!subcategory) {
      return res.redirect('/admin/subcategories');
    }
    res.render('admin/subcategories/edit', { title: 'Edit Subcategory', subcategory, categories });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// Update Subcategory
router.post('/edit/:id', async (req, res) => {
  try {
    const subcategory = await Subcategory.findById(req.params.id);
    if (!subcategory) {
      return res.redirect('/admin/subcategories');
    }
    subcategory.set({
      name: req.body.name,
      category: req.body.category,
      description: req.body.description
    });
    await subcategory.save();
    req.flash('success', 'Subcategory updated successfully.');
    res.redirect('/admin/subcategories');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to update subcategory.');
    res.redirect(`/admin/subcategories/edit/${req.params.id}`);
  }
});

// Delete Subcategory (guarded)
router.post('/delete/:id', async (req, res) => {
  try {
    const productCount = await Product.countDocuments({ subcategory: req.params.id });
    if (productCount > 0) {
      req.flash('error', `Cannot delete — ${productCount} products still reference this subcategory.`);
      return res.redirect('/admin/subcategories');
    }
    await Subcategory.findByIdAndDelete(req.params.id);
    req.flash('success', 'Subcategory deleted successfully.');
    res.redirect('/admin/subcategories');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to delete subcategory.');
    res.redirect('/admin/subcategories');
  }
});

module.exports = router;
