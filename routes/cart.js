const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const { calcDeliveryFee } = require('../utils/currency');
const { getAppSettings } = require('../services/appSettingsService');

function readCartCookie(req) {
  if (!req.cookies.cart) return [];
  try {
    const parsed = JSON.parse(req.cookies.cart);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

// Get Cart
router.get('/', async (req, res) => {
  try {
    const cartCookie = readCartCookie(req);

    // One query for every product in the cart, instead of one query per
    // item (N+1) — quantities are then merged back in from the cookie.
    const validIds = cartCookie
      .filter(item => mongoose.isValidObjectId(item.productId))
      .map(item => item.productId);
    const products = await Product.find({ _id: { $in: validIds } }).populate('category');
    const productsById = new Map(products.map(p => [p._id.toString(), p]));

    const cartItems = [];
    let subtotal = 0;
    for (const item of cartCookie) {
      const product = productsById.get(item.productId);
      if (product) {
        cartItems.push({ product, quantity: item.quantity });
        subtotal += product.price * item.quantity;
      }
    }

    const tax = subtotal * 0.05; // 5% tax
    const shipping = subtotal > 0 ? calcDeliveryFee('Standard') : 0;
    const total = subtotal + tax + shipping;

    const appSettings = await getAppSettings();

    res.render('cart', {
      title: 'Your Shopping Cart',
      cartItems,
      subtotal,
      tax,
      shipping,
      total,
      whatsappBookingEnabled: appSettings.whatsappBookingEnabled
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Add to Cart
router.post('/add/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    const quantity = parseInt(req.body.quantity) || 1;

    const product = await Product.findById(productId);
    if (!product) {
      req.flash('error', 'Product not found.');
      return res.redirect(req.get('Referrer') || '/products');
    }

    if (product.stock <= 0) {
      req.flash('error', `${product.name} is currently out of stock.`);
      return res.redirect(req.get('Referrer') || '/products');
    }

    let cart = readCartCookie(req);
    const existingItemIndex = cart.findIndex(item => item.productId === productId);
    const currentQtyInCart = existingItemIndex > -1 ? cart[existingItemIndex].quantity : 0;
    const desiredQty = currentQtyInCart + quantity;

    if (desiredQty > product.stock) {
      req.flash('error', `Only ${product.stock} unit(s) of ${product.name} available. Your cart already has ${currentQtyInCart}.`);
      return res.redirect(req.get('Referrer') || '/products');
    }

    if (existingItemIndex > -1) {
      cart[existingItemIndex].quantity = desiredQty;
    } else {
      cart.push({ productId, quantity });
    }

    res.cookie('cart', JSON.stringify(cart), { maxAge: 9000000, httpOnly: true });
    req.flash('success', `${product.name} added to cart.`);
    res.redirect(req.get('Referrer') || '/products');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not add product to cart.');
    res.redirect(req.get('Referrer') || '/products');
  }
});

// Remove from Cart
router.post('/remove/:id', (req, res) => {
  try {
    const productId = req.params.id;
    let cart = readCartCookie(req);

    cart = cart.filter(item => item.productId !== productId);

    res.cookie('cart', JSON.stringify(cart), { maxAge: 9000000, httpOnly: true });
    res.redirect('/cart');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not update cart.');
    res.redirect('/cart');
  }
});

// Update Quantity
router.post('/update/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    let quantity = parseInt(req.body.quantity) || 1;
    let cart = readCartCookie(req);

    const existingItemIndex = cart.findIndex(item => item.productId === productId);
    if (existingItemIndex > -1) {
      if (quantity > 0) {
        const product = await Product.findById(productId);
        if (product && quantity > product.stock) {
          quantity = product.stock;
          req.flash('error', `Only ${product.stock} unit(s) of ${product.name} available.`);
        }
        cart[existingItemIndex].quantity = quantity;
      } else {
        cart = cart.filter(item => item.productId !== productId);
      }
    }

    res.cookie('cart', JSON.stringify(cart), { maxAge: 9000000, httpOnly: true });
    res.redirect('/cart');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not update cart.');
    res.redirect('/cart');
  }
});

module.exports = router;
