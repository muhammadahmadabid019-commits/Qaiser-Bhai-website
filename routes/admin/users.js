const express = require('express');
const router = express.Router();
const User = require('../../models/User');

// GET /admin/users - show grant/revoke admin forms + current admins list
router.get('/', async (req, res) => {
  try {
    const admins = await User.find({ role: 'admin' }).sort('name');
    res.render('admin/users/index', {
      title: 'Manage Admins',
      admins,
      currentUserId: req.session.userId
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not load admins.');
    res.redirect('/admin/dashboard');
  }
});

// POST /admin/users/make-admin - grant admin access by email
router.post('/make-admin', async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();

    if (!email) {
      req.flash('error', 'Please enter an email address.');
      return res.redirect('/admin/users');
    }

    const user = await User.findOne({ email });

    if (!user) {
      req.flash('error', `No registered user found with email "${email}". They must sign up first.`);
      return res.redirect('/admin/users');
    }

    if (user.role === 'admin') {
      req.flash('error', `${user.name} (${user.email}) is already an admin.`);
      return res.redirect('/admin/users');
    }

    user.role = 'admin';
    await user.save();

    req.flash('success', `${user.name} (${user.email}) now has admin access.`);
    res.redirect('/admin/users');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Something went wrong. Please try again.');
    res.redirect('/admin/users');
  }
});

// POST /admin/users/remove-admin - revoke admin access by email
router.post('/remove-admin', async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();

    if (!email) {
      req.flash('error', 'Please enter an email address.');
      return res.redirect('/admin/users');
    }

    const user = await User.findOne({ email });

    if (!user) {
      req.flash('error', `No registered user found with email "${email}".`);
      return res.redirect('/admin/users');
    }

    if (user.role !== 'admin') {
      req.flash('error', `${user.name} (${user.email}) is not an admin.`);
      return res.redirect('/admin/users');
    }

    // Prevent an admin from removing their own admin access
    if (user._id.toString() === req.session.userId.toString()) {
      req.flash('error', 'You cannot remove your own admin access.');
      return res.redirect('/admin/users');
    }

    // Prevent removing the last remaining admin
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount <= 1) {
      req.flash('error', 'Cannot remove the last remaining admin.');
      return res.redirect('/admin/users');
    }

    user.role = 'customer';
    await user.save();

    req.flash('success', `Admin access removed from ${user.name} (${user.email}).`);
    res.redirect('/admin/users');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Something went wrong. Please try again.');
    res.redirect('/admin/users');
  }
});

module.exports = router;
