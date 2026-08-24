const express = require('express');
const router = express.Router();
const Product = require('../../models/Product');
const Category = require('../../models/Category');
const Subcategory = require('../../models/Subcategory');
const Quote = require('../../models/Quote');
const Order = require('../../models/Order');
const User = require('../../models/User');
const { LOW_STOCK_THRESHOLD } = require('../../utils/inventory');

// GET /admin/dashboard
router.get('/', async (req, res) => {
  try {
    const [
      totalProducts,
      totalCategories,
      totalSubcategories,
      totalQuotes,
      totalOrders,
      totalUsers,
      pendingOrders,
      pendingPaymentVerification,
      deliveredOrders,
      cancelledOrders,
      newQuotes,
      inProgressQuotes,
      closedQuotes,
      lowStockProducts,
      recentProducts
    ] = await Promise.all([
      Product.countDocuments(),
      Category.countDocuments(),
      Subcategory.countDocuments(),
      Quote.countDocuments(),
      Order.countDocuments(),
      User.countDocuments(),
      Order.countDocuments({ status: 'Pending' }),
      Order.countDocuments({ paymentStatus: 'Pending Verification' }),
      Order.countDocuments({ status: 'Delivered' }),
      Order.countDocuments({ status: 'Cancelled' }),
      Quote.countDocuments({ status: 'New' }),
      Quote.countDocuments({ status: 'In Progress' }),
      Quote.countDocuments({ status: 'Closed' }),
      Product.find({ stock: { $lte: LOW_STOCK_THRESHOLD } }).sort('stock').limit(5),
      Product.find().populate('category').sort('-createdAt').limit(5)
    ]);

    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      stats: {
        totalProducts,
        totalCategories,
        totalSubcategories,
        totalQuotes,
        totalOrders,
        totalUsers,
        pendingOrders,
        pendingPaymentVerification,
        deliveredOrders,
        cancelledOrders,
        newQuotes,
        inProgressQuotes,
        closedQuotes
      },
      lowStockProducts,
      recentProducts
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;