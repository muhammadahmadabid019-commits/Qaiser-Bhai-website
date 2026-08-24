const express = require('express');
const router = express.Router();

const Quote = require('../models/Quote');
const Category = require('../models/Category');
const Review = require('../models/Review');
const { EMAIL_FORMAT, PAKISTAN_MOBILE_FORMAT } = require('../utils/validation');
const { getAppSettings } = require('../services/appSettingsService');

// Landing page route
router.get('/', async (req, res) => {
  try {
    const services = await Category.find({ type: 'service' }).sort('name');
    const appSettings = await getAppSettings();
    
    // Only ever query status: 'Approved' — pending/rejected reviews must
    // never reach a public-facing render.
    const reviews = await Review.find({ status: 'Approved' }).sort('-createdAt').limit(9);
    res.render('index', {
      title: 'unieQ Solutions - Home',
      services,
      reviews,
      whatsappBookingEnabled: appSettings.whatsappBookingEnabled
    });
  } catch (err) {
    console.error(err);
    res.render('index', {
      title: 'unieQ Solutions - Home',
      services: [],
      reviews: []
    });
  }
});

// POST /quote - Save free quote request. Shared by the homepage contact
// form and the "Inquire About This Product" modal on product-detail.ejs —
// both submit here, so this validation covers both entry points.
router.post('/quote', async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    const phone = (req.body.phone || '').trim();
    const email = (req.body.email || '').trim();
    const service = (req.body.service || '').trim();
    const message = (req.body.message || '').trim();

    if (!name || !phone || !email || !service) {
      return res.status(400).json({
        success: false,
        message: 'Please fill in all required fields.'
      });
    }
    if (name.length < 3 || name.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Name must be between 3 and 100 characters.'
      });
    }
    if (!EMAIL_FORMAT.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address.'
      });
    }
    if (!PAKISTAN_MOBILE_FORMAT.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid Pakistani mobile number.'
      });
    }
    if (!message || message.length < 20 || message.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Message must be between 20 and 1000 characters.'
      });
    }

    const quote = await Quote.create({ name, phone, email, service, message });

    res.status(201).json({
      success: true,
      message: 'Thank you! Your request has been received — our team will contact you within 24 hours.',
      quote
    });
  } catch (err) {
    console.error('Quote Submission Error:', err);
    res.status(500).json({
      success: false,
      message: 'Server Error. Failed to save quote request.'
    });
  }
});

// POST /reviews - customer submits a review; always created as Pending.
// Login required (same convention as checkout) so every review is tied to
// a real account — customers can never set status themselves, this route
// never accepts a status field from the request body.
//
// Uses an inline session check instead of the isLoggedIn middleware
// (which redirects on failure) because this is a JSON/AJAX endpoint, not a
// page route — a redirect response would break the client-side fetch/AJAX
// handler. Same reasoning routes/api.js already applies (JWT-verified JSON
// endpoints there also don't use the redirect-based middlewares).
router.post('/reviews', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ success: false, message: 'Please log in to submit a review.' });
    }

    const { customerName, rating, message } = req.body;
    const ratingNum = parseInt(rating, 10);

    if (!customerName || !customerName.trim()) {
      return res.status(400).json({ success: false, message: 'Please enter your name.' });
    }
    if (!rating || isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ success: false, message: 'Please select a rating between 1 and 5 stars.' });
    }
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Please write a review message.' });
    }

    await Review.create({
      user: req.session.userId,
      customerName: customerName.trim(),
      rating: ratingNum,
      message: message.trim()
    });

    res.status(201).json({
      success: true,
      message: 'Your review has been submitted successfully.'
    });
  } catch (err) {
    console.error('Review Submission Error:', err);
    res.status(500).json({ success: false, message: 'Server Error. Failed to save your review.' });
  }
});

module.exports = router;
