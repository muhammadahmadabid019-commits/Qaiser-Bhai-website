const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Category = require('../models/Category');
const User = require('../models/User');
const Order = require('../models/Order');
const verifyToken = require('../middlewares/verifyToken');
const { loginLimiter } = require('../middlewares/rateLimiters');
const { CURRENCY_CODE, calcDeliveryFee } = require('../utils/currency');
const { deductStockForItems } = require('../services/inventoryService');
const { escapeRegex } = require('../utils/validation');

// ==========================================
// 1. PUBLIC ENDPOINTS
// ==========================================

/**
 * @route   GET /api/v1/products
 * @desc    Get all products with pagination, search, and category filtering
 * @access  Public
 */
router.get('/products', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 8;
    const skip = (page - 1) * limit;

    const query = {};

    // Search by name
    if (req.query.search) {
      query.name = { $regex: escapeRegex(req.query.search), $options: 'i' };
    }

    // Filter by category
    if (req.query.category && req.query.category !== '') {
      query.category = req.query.category;
    }

    // Filter by price range
    if (req.query.minPrice || req.query.maxPrice) {
      query.price = {};
      if (req.query.minPrice) query.price.$gte = Number(req.query.minPrice);
      if (req.query.maxPrice) query.price.$lte = Number(req.query.maxPrice);
    }

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);

    const products = await Product.find(query)
      .populate('category')
      .skip(skip)
      .limit(limit)
      .sort('-createdAt');

    res.json({
      success: true,
      currency: CURRENCY_CODE,
      count: products.length,
      pagination: {
        totalProducts,
        totalPages,
        currentPage: page,
        limit
      },
      products
    });
  } catch (err) {
    console.error('API Products Fetch Error:', err);
    res.status(500).json({
      success: false,
      message: 'Server Error. Failed to fetch products.'
    });
  }
});

/**
 * @route   GET /api/v1/products/:id
 * @desc    Get details for a single product by ID
 * @access  Public
 */
router.get('/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('category');
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }

    res.json({
      success: true,
      currency: CURRENCY_CODE,
      product
    });
  } catch (err) {
    console.error('API Single Product Fetch Error:', err);
    if (err.kind === 'ObjectId') {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format.'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server Error. Failed to fetch product details.'
    });
  }
});

// ==========================================
// 2. AUTHENTICATION ENDPOINTS
// ==========================================

/**
 * @route   POST /api/v1/auth/login
 * @desc    Sign in user and return JWT token
 * @access  Public
 */
router.post('/auth/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Basic validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password.'
      });
    }

    // 2. Find user in database
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // 3. Verify password
    // Wait, in Semester Project models/User.js, the compare method is named `matchPassword` instead of `comparePassword`!
    // Let's verify: Yes! UserSchema.methods.matchPassword = async function(enteredPassword) { ... }
    // Let's make sure we use `matchPassword` for the Semester Project!
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // 4. Generate JWT token
    const payload = {
      userId: user._id,
      role: user.role
    };

    const expiresIn = process.env.JWT_EXPIRES_IN || '1h';

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });

    res.json({
      success: true,
      message: 'Authentication successful.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('API Auth Login Error:', err);
    res.status(500).json({
      success: false,
      message: 'Server Error. Login failed.'
    });
  }
});

// ==========================================
// 3. PROTECTED ENDPOINTS (Requires JWT)
// ==========================================

/**
 * @route   POST /api/v1/orders
 * @desc    Allows logged-in user to submit an order
 * @access  Private (JWT Protected)
 */
router.post('/orders', verifyToken, async (req, res) => {
  try {
    const { items, shippingAddress } = req.body;

    // 1. Basic validation
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please add items to your order.'
      });
    }

    if (!shippingAddress || shippingAddress.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Shipping address is required.'
      });
    }

    // 2. Validate products, live stock, and calculate total amount
    let totalAmount = 0;
    const validatedItems = [];

    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity < 1) {
        return res.status(400).json({
          success: false,
          message: 'Invalid product item format. Ensure productId and quantity (min 1) are passed.'
        });
      }

      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product with ID ${item.productId} not found.`
        });
      }

      // Fast, friendly pre-check (same pattern as routes/checkout.js) —
      // the authoritative, race-condition-safe check is the atomic
      // deduction inside the transaction below.
      if (item.quantity > product.stock) {
        return res.status(400).json({
          success: false,
          message: `Only ${product.stock} item(s) of "${product.name}" are currently available in stock.`
        });
      }

      validatedItems.push({
        product: product._id,
        name: product.name,
        price: product.price,
        quantity: item.quantity
      });

      totalAmount += product.price * item.quantity;
    }

    // 3. Add tax (5%) and shipping fee (Standard tier — this endpoint
    // doesn't expose a delivery-method choice, so it always uses Standard,
    // same as the cart preview).
    const tax = totalAmount * 0.05;
    const shipping = calcDeliveryFee('Standard');
    const finalTotal = totalAmount + tax + shipping;

    // 4. Deduct stock and create the order in one transaction — see
    // routes/checkout.js for the identical pattern and rationale.
    const session = await mongoose.startSession();
    let order;
    try {
      await session.withTransaction(async () => {
        await deductStockForItems(
          validatedItems.map(item => ({ productId: item.product, quantity: item.quantity, name: item.name })),
          session
        );

        const [createdOrder] = await Order.create([{
          user: req.user.userId,
          items: validatedItems,
          totalAmount: finalTotal,
          subtotal: totalAmount,
          tax,
          deliveryFee: shipping,
          shippingAddress: { street: shippingAddress } // legacy plain-string address from this API
        }], { session });

        order = createdOrder;
      });
    } finally {
      session.endSession();
    }

    // 5. Populate and return details
    const populatedOrder = await Order.findById(order._id)
      .populate('user', 'name email')
      .populate('items.product', 'name price image');

    res.status(201).json({
      success: true,
      message: 'Order created successfully.',
      currency: CURRENCY_CODE,
      order: populatedOrder
    });
  } catch (err) {
    console.error('API Create Order Error:', err);
    if (err.code === 'INSUFFICIENT_STOCK') {
      return res.status(409).json({
        success: false,
        message: err.message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server Error. Failed to submit order.'
    });
  }
});

/**
 * @route   GET /api/v1/user/profile
 * @desc    Get profile for currently authenticated user
 * @access  Private (JWT Protected)
 */
router.get('/user/profile', verifyToken, async (req, res) => {
  try {
    // req.user has userId from verified JWT token
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (err) {
    console.error('API Get Profile Error:', err);
    res.status(500).json({
      success: false,
      message: 'Server Error. Failed to load profile.'
    });
  }
});

module.exports = router;
