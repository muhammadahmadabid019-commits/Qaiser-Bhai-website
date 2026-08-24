const express = require('express');
const router = express.Router();
const User = require('../models/User');

// GET /auth/register
router.get('/register', (req, res) => {
  if (req.session.userId) {
    if (req.session.userRole && req.session.userRole.toLowerCase() === 'admin') {
      return res.redirect('/admin/products');
    }
    return res.redirect('/');
  }
  res.render('auth/register', { title: 'Create Account' });
});

// POST /auth/register
router.post('/register', async (req, res) => {
  const { name, email, password, password2 } = req.body;

  // Basic validation
  if (!name || !email || !password || !password2) {
    req.flash('error', 'Please fill in all fields.');
    return res.redirect('/auth/register');
  }

  if (password !== password2) {
    req.flash('error', 'Passwords do not match.');
    return res.redirect('/auth/register');
  }

  if (password.length < 6) {
    req.flash('error', 'Password must be at least 6 characters long.');
    return res.redirect('/auth/register');
  }

  try {
    // Check if email is already taken
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      req.flash('error', 'That email is already registered. Please log in.');
      return res.redirect('/auth/register');
    }

    // Create new user (password is hashed by pre-save hook in User model)
    const user = await User.create({ name, email, password });

    // Log the user in immediately after registration
    req.session.userId = user._id;
    req.session.userName = user.name;
    req.session.userRole = user.role;

    req.session.save((err) => {
      if (err) console.error('Session save error:', err);
      req.flash('success', `Welcome, ${user.name}! Your account has been created.`);
      if (user.role && user.role.toLowerCase() === 'admin') {
        return res.redirect('/admin/products');
      }
      res.redirect('/');
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Something went wrong. Please try again.');
    res.redirect('/auth/register');
  }
});

// GET /auth/login
router.get('/login', (req, res) => {
  if (req.session.userId) {
    if (req.session.userRole && req.session.userRole.toLowerCase() === 'admin') {
      return res.redirect('/admin/products');
    }
    return res.redirect('/');
  }
  res.render('auth/login', { title: 'Login' });
});

// POST /auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    req.flash('error', 'Please enter your email and password.');
    return res.redirect('/auth/login');
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      req.flash('error', 'Invalid email or password.');
      return res.redirect('/auth/login');
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      req.flash('error', 'Invalid email or password.');
      return res.redirect('/auth/login');
    }

    // Save user info to session
    req.session.userId = user._id;
    req.session.userName = user.name;
    req.session.userRole = user.role;

    console.log('--- ADMIN LOGIN REDIRECT DEBUG ---');
    console.log('User model from DB:', {
      id: user._id,
      email: user.email,
      role: user.role,
      roleLower: user.role ? user.role.toLowerCase() : null
    });

    req.session.save((err) => {
      if (err) console.error('Session save error:', err);
      req.flash('success', `Welcome back, ${user.name}!`);
      if (user.role && user.role.trim().toLowerCase() === 'admin') {
        console.log('Redirecting to /admin/products...');
        return res.redirect('/admin/products');
      }
      console.log('Redirecting to / (Default)...');
      res.redirect('/');
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Something went wrong. Please try again.');
    res.redirect('/auth/login');
  }
});

// POST /auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/auth/login');
  });
});

module.exports = router;
