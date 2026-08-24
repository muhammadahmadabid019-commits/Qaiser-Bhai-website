require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const expressLayouts = require('express-ejs-layouts');
// Removed config module to avoid Vercel bundling issues
const path = require('path');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const flash = require('connect-flash');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const csrf = require('./middlewares/csrf');

// Routes
const indexRoutes = require('./routes/index');
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const checkoutRoutes = require('./routes/checkout');
const orderRoutes = require('./routes/orders');
const authRoutes = require('./routes/auth');
const adminProductRoutes = require('./routes/admin/products');
const adminCategoryRoutes = require('./routes/admin/categories');
const adminSubcategoryRoutes = require('./routes/admin/subcategories');
const adminDashboardRoutes = require('./routes/admin/dashboard');
const adminUserRoutes = require('./routes/admin/users');
const adminQuoteRoutes = require('./routes/admin/quotes');
const adminOrderRoutes = require('./routes/admin/orders');
const adminReviewRoutes = require('./routes/admin/reviews');
const adminPaymentSettingsRoutes = require('./routes/admin/paymentSettings');
const adminOrderRetentionRoutes = require('./routes/admin/orderRetentionSettings');
const apiRoutes = require('./routes/api');

// Middlewares
const { isAdmin } = require('./middlewares/auth');

const app = express();

app.use(cors());
app.use(compression());

// Configuration
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

// Fail fast and clearly rather than silently falling back to a hardcoded
// connection string — a committed database credential is a security risk
// in itself, independent of whether it's ever actually reached.
if (!MONGO_URI) {
  console.error('FATAL: MONGO_URI environment variable is not set. Copy .env.example to .env and fill in real values.');
  process.exit(1);
}

// Fail fast rather than silently falling back to a hardcoded secret — a
// known, publicly-readable session secret lets an attacker forge session
// cookies (including admin sessions) and a known JWT secret lets them
// forge admin-role API tokens.
if (!process.env.SESSION_SECRET) {
  console.error('FATAL: SESSION_SECRET environment variable is not set. Copy .env.example to .env and fill in real values.');
  process.exit(1);
}
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set. Copy .env.example to .env and fill in real values.');
  process.exit(1);
}

// Connect to MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

// Set up EJS and Layouts
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layout');

// Centralized currency formatting, available in every view as formatPrice()
app.locals.formatPrice = require('./utils/currency').formatPrice;

// Centralized stock status (In Stock / Low Stock / Out of Stock), available
// in every view as getStockStatus(stock) — single source of truth instead
// of each view hardcoding its own threshold.
app.locals.getStockStatus = require('./utils/inventory').getStockStatus;

// Global WhatsApp number for contact and bookings
app.locals.whatsappNumber = process.env.WHATSAPP_NUMBER || '923018999603';

// Built-in Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Long cache lifetime for static assets (images, css, js) — the biggest
// contributor to slow repeat page loads was every asset being re-fetched
// on every request with no caching headers at all.
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '30d' : 0,
  etag: true
}));
app.use(cookieParser());

// Session Configuration (stored in MongoDB)
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: MONGO_URI }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 1 day
    sameSite: 'lax' // baseline CSRF mitigation: cookie isn't sent on cross-site form POSTs
  }
}));

// Flash Messages
app.use(flash());

// Global variables for all views
app.use((req, res, next) => {
  // Flash messages
  res.locals.messages = {
    success: req.flash('success'),
    error: req.flash('error')
  };

  // Current request path, used by admin-layout.ejs to highlight the active
  // sidebar section.
  res.locals.currentPath = req.path;

  // Logged-in user info
  res.locals.currentUser = {
    id: req.session.userId || null,
    name: req.session.userName || null,
    role: req.session.userRole || null
  };

  // Cart badge count (from cookie)
  let cartCount = 0;
  if (req.cookies.cart) {
    try {
      const cart = JSON.parse(req.cookies.cart);
      cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
    } catch (e) {}
  }
  res.locals.cartCount = cartCount;

  next();
});

// Set Admin Layout for admin routes
app.use('/admin', (req, res, next) => {
  res.locals.layout = 'admin-layout';
  next();
});
// CSRF protection for the admin panel's forms (issues/exposes a per-session
// token to every admin view, and rejects state-changing requests that don't
// carry a matching token).
app.use('/admin', csrf.ensureToken, csrf.verifyToken);
app.get('/admin', isAdmin, (req, res) => res.redirect('/admin/dashboard'));

// Mount Routes
app.use('/', indexRoutes);
app.use('/products', productRoutes);
app.use('/cart', cartRoutes);
app.use('/checkout', checkoutRoutes);
app.use('/orders', orderRoutes);
app.use('/auth', authRoutes);
app.use('/admin/dashboard', isAdmin, adminDashboardRoutes);
app.use('/admin/users', isAdmin, adminUserRoutes); // Protected by isAdmin // Protected by isAdmin
app.use('/admin/quotes', isAdmin, adminQuoteRoutes); // Protected by isAdmin
app.use('/admin/orders', isAdmin, adminOrderRoutes); // Protected by isAdmin
app.use('/admin/reviews', isAdmin, adminReviewRoutes); // Protected by isAdmin
app.use('/admin/payment-settings', isAdmin, adminPaymentSettingsRoutes); // Protected by isAdmin
app.use('/admin/order-retention', isAdmin, adminOrderRetentionRoutes);   // Protected by isAdmin
app.use('/admin/products', isAdmin, adminProductRoutes); // Protected by isAdmin
app.use('/admin/categories', isAdmin, adminCategoryRoutes);
app.use('/admin/subcategories', isAdmin, adminSubcategoryRoutes);
app.use('/api/v1', apiRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).render('404', { title: '404 - Page Not Found' });
});

// Start Server
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
