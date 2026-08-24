const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const User = require('../models/User');
const Order = require('../models/Order');
const { isLoggedIn } = require('../middlewares/auth');
const {
  STANDARD_DELIVERY_FEE,
  EXPRESS_DELIVERY_FEE,
  calcDeliveryFee
} = require('../utils/currency');
const { getCityNames, isValidCity } = require('../data/pakistanCities');
const { isValidPaymentMethod, getPaymentMethodConfig } = require('../data/paymentMethods');
const { initializePayment, recordPaymentProof } = require('../services/paymentService');
const { deductStockForItems } = require('../services/inventoryService');
const { getBankTransferSettings } = require('../services/paymentSettingsService');
const { sendOrderConfirmation } = require('../services/emailService');
const { EMAIL_FORMAT } = require('../utils/validation');

const TAX_RATE = 0.05;
const TRANSACTION_REFERENCE_MIN_LENGTH = 4;
const TRANSACTION_REFERENCE_MAX_LENGTH = 100;

// Extensions we accept for receipt uploads. Used both by multer's fileFilter
// (to reject anything else up front) and again when building the stored
// filename below, so the on-disk extension is always taken from this fixed
// whitelist rather than echoed from user-controlled input.
const ALLOWED_RECEIPT_EXTENSIONS = { '.jpeg': '.jpeg', '.jpg': '.jpg', '.png': '.png', '.webp': '.webp', '.pdf': '.pdf' };

// Payment receipts are stored outside public/ and are only ever served via
// the authenticated GET /confirmation/:id/receipt route below (ownership
// checked) — unlike product images, these can contain sensitive financial
// info and must not be world-readable static files.
// Same ephemeral-filesystem caveat as routes/admin/products.js: on Vercel,
// only /tmp is writable at runtime and does not persist across deploys/
// instances. Fine for local/traditional hosting; real persistence for a
// serverless deployment needs object storage (S3/Vercel Blob/Cloudinary),
// which is out of scope for this phase.
function getReceiptUploadDir() {
  return process.env.NODE_ENV === 'production'
    ? '/tmp/receipts'
    : path.join(__dirname, '../uploads/receipts');
}

const receiptStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = getReceiptUploadDir();
    if (process.env.NODE_ENV !== 'production' && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    // Order id comes from the route param (already an ObjectId-validated
    // Mongoose lookup downstream) and the extension is taken from our fixed
    // whitelist below, never echoed from file.originalname directly — this
    // is what actually prevents a crafted filename (e.g. containing "..",
    // path separators, or a disallowed extension) from reaching the
    // filesystem, regardless of what fileFilter already rejected.
    const safeExt = ALLOWED_RECEIPT_EXTENSIONS[path.extname(file.originalname).toLowerCase()] || '.bin';
    cb(null, `receipt-${req.params.id}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${safeExt}`);
  }
});

const uploadReceipt = multer({
  storage: receiptStorage,
  limits: { fileSize: 5000000 },
  fileFilter: function (req, file, cb) {
    const allowedMime = /^image\/(jpeg|png|webp)$|^application\/pdf$/;
    const extOk = Object.prototype.hasOwnProperty.call(ALLOWED_RECEIPT_EXTENSIONS, path.extname(file.originalname).toLowerCase());
    const mimeOk = allowedMime.test(file.mimetype);
    if (extOk && mimeOk) {
      return cb(null, true);
    }
    cb(new Error('Only JPG, PNG, WEBP, or PDF files are allowed.'));
  }
});

const PAKISTAN_PROVINCES = [
  'Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan',
  'Gilgit Baltistan', 'Azad Jammu & Kashmir'
];

// Helper: read + hydrate cart from cookie, return items + subtotal
async function getCartFromCookie(req) {
  const cartCookie = req.cookies.cart ? JSON.parse(req.cookies.cart) : [];
  const cartItems = [];
  let subtotal = 0;

  for (let item of cartCookie) {
    const product = await Product.findById(item.productId);
    if (product) {
      cartItems.push({ product, quantity: item.quantity });
      subtotal += product.price * item.quantity;
    }
  }
  return { cartItems, subtotal };
}

// Server-side validation of checkout form fields + live stock (never trust
// client-only validation). Returns an array of user-facing error messages;
// empty array means the submission is valid. Async because Bank Transfer's
// enabled/disabled state now lives in the database (PaymentSettings), not a
// hardcoded constant — a customer could otherwise submit an order for a
// method an admin just turned off.
async function validateCheckoutFields(body, cartItems) {
  const { firstName, lastName, email, phone, street, city, province, deliveryMethod, paymentMethod, paymentAccountNumber } = body;
  const errors = [];

  if (!firstName || !firstName.trim()) errors.push('First name is required.');
  if (!lastName || !lastName.trim()) errors.push('Last name is required.');
  if (!phone || !/^03\d{9}$/.test(phone.trim())) errors.push('A valid Pakistani phone number (03XXXXXXXXX) is required.');
  if (!email || !email.trim()) {
    errors.push('Email address is required.');
  } else if (!EMAIL_FORMAT.test(email.trim())) {
    errors.push('Please enter a valid email address.');
  }
  if (!street || !street.trim()) errors.push('Street address is required.');
  if (!city || !isValidCity(city)) errors.push('Please select a valid city.');
  if (!province || !PAKISTAN_PROVINCES.includes(province)) errors.push('Please select a valid province.');
  if (!['Standard', 'Express'].includes(deliveryMethod)) errors.push('Please select a valid delivery method.');
  if (!isValidPaymentMethod(paymentMethod)) {
    errors.push('Please select a valid payment method.');
  } else if (getPaymentMethodConfig(paymentMethod).requiresAccountNumber && (!paymentAccountNumber || !paymentAccountNumber.trim())) {
    errors.push(`An account number is required for ${paymentMethod}.`);
  } else if (paymentMethod === 'Bank Transfer') {
    const bankTransfer = await getBankTransferSettings();
    if (!bankTransfer.enabled) {
      errors.push('Bank Transfer is currently unavailable. Please choose a different payment method.');
    }
  }

  // Re-validate stock at time of order (it may have changed since cart was built)
  for (const item of cartItems) {
    if (item.quantity > item.product.stock) {
      errors.push(`Only ${item.product.stock} unit(s) of ${item.product.name} available.`);
    }
  }

  return errors;
}

// GET /checkout - show checkout form
router.get('/', isLoggedIn, async (req, res) => {
  try {
    const { cartItems, subtotal } = await getCartFromCookie(req);

    if (cartItems.length === 0) {
      req.flash('error', 'Your cart is empty. Add something before checking out.');
      return res.redirect('/cart');
    }

    const currentUser = await User.findById(req.session.userId);
    const deliveryMethod = 'Standard';
    const deliveryFee = calcDeliveryFee(deliveryMethod);
    const tax = subtotal * TAX_RATE;
    const total = subtotal + tax + deliveryFee;
    const bankTransfer = await getBankTransferSettings();

    res.render('checkout', {
      title: 'Checkout',
      cartItems,
      subtotal,
      tax,
      deliveryFee,
      total,
      deliveryMethod,
      cities: getCityNames(),
      provinces: PAKISTAN_PROVINCES,
      standardFee: STANDARD_DELIVERY_FEE,
      expressFee: EXPRESS_DELIVERY_FEE,
      currentUser,
      bankTransfer
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not load checkout page.');
    res.redirect('/cart');
  }
});

// POST /checkout/place-order - validate, create Order, clear cart
router.post('/place-order', isLoggedIn, async (req, res) => {
  try {
    const { cartItems, subtotal } = await getCartFromCookie(req);

    if (cartItems.length === 0) {
      req.flash('error', 'Your cart is empty.');
      return res.redirect('/cart');
    }

    const {
      firstName, lastName, email, phone,
      houseNo, street, area, city, province, postalCode,
      deliveryMethod, paymentMethod, paymentAccountNumber
    } = req.body;

    const errors = await validateCheckoutFields(req.body, cartItems);

    if (errors.length > 0) {
      errors.forEach(msg => req.flash('error', msg));
      return res.redirect('/checkout');
    }

    // Recompute all totals server-side (never trust client-submitted prices)
    const deliveryFee = calcDeliveryFee(deliveryMethod);
    const tax = subtotal * TAX_RATE;
    const totalAmount = subtotal + tax + deliveryFee;

    // Payment handling is intentionally separate from order creation — see
    // services/paymentService.js. This determines paymentStatus/
    // paymentAccountNumber/transactionReference; it does not touch order
    // fulfillment status below.
    const payment = initializePayment(paymentMethod, { paymentAccountNumber });

    // Stock deduction and order creation happen inside one transaction:
    // if any item no longer has enough stock at the moment of the write
    // (e.g. another customer bought it in the last few seconds), or order
    // creation fails for any reason, everything rolls back — no item ends
    // up with stock deducted but no order, or an order with unreserved
    // stock. The earlier validateCheckoutFields() stock check above is a
    // fast, friendly pre-check for the common case; this is the
    // authoritative, race-condition-safe gate.
    const session = await mongoose.startSession();
    let order;
    try {
      await session.withTransaction(async () => {
        await deductStockForItems(
          cartItems.map(item => ({
            productId: item.product._id,
            quantity: item.quantity,
            name: item.product.name
          })),
          session
        );

        const [createdOrder] = await Order.create([{
          user: req.session.userId,
          items: cartItems.map(item => ({
            product: item.product._id,
            name: item.product.name,
            price: item.product.price,
            quantity: item.quantity
          })),
          customerName: `${firstName.trim()} ${lastName.trim()}`,
          phone: phone.trim(),
          email: email.trim(),
          shippingAddress: {
            houseNo: houseNo ? houseNo.trim() : '',
            street: street.trim(),
            area: area ? area.trim() : '',
            city,
            province,
            postalCode: postalCode ? postalCode.trim() : ''
          },
          deliveryMethod,
          deliveryFee,
          paymentMethod: payment.paymentMethod,
          paymentStatus: payment.paymentStatus,
          paymentAccountNumber: payment.paymentAccountNumber,
          transactionReference: payment.transactionReference,
          subtotal,
          tax,
          totalAmount,
          status: 'Pending'
        }], { session });

        order = createdOrder;
      });
    } finally {
      session.endSession();
    }

    // Best-effort — the order is already committed above, so a failed or
    // slow email must never turn a successful order placement into an
    // error response for the customer.
    try {
      await sendOrderConfirmation(order);
    } catch (err) {
      console.error(`Order confirmation email failed for order ${order._id}:`, err);
    }

    // Clear the cart now that the order is placed
    res.clearCookie('cart');

    res.redirect(`/checkout/confirmation/${order._id}`);
  } catch (err) {
    console.error('Order creation failed:', err);
    if (err.code === 'INSUFFICIENT_STOCK') {
      req.flash('error', err.message);
    } else if (err.name === 'ValidationError') {
      req.flash('error', 'Some order details were invalid. Please review your information and try again.');
    } else if (err.name === 'MongoServerError' || err.name === 'MongooseServerSelectionError' || err.name === 'MongoNetworkError') {
      req.flash('error', 'We could not reach the database right now. Your cart has been kept — please try again in a moment.');
    } else {
      req.flash('error', 'Something went wrong while placing your order. Please try again.');
    }
    res.redirect('/checkout');
  }
});

// GET /checkout/confirmation/:id
router.get('/confirmation/:id', isLoggedIn, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('items.product', 'name image slug');

    if (!order || order.user.toString() !== req.session.userId.toString()) {
      req.flash('error', 'Order not found.');
      return res.redirect('/');
    }

    const paymentConfig = getPaymentMethodConfig(order.paymentMethod);
    const bankTransfer = order.paymentMethod === 'Bank Transfer' ? await getBankTransferSettings() : null;

    res.render('checkout-confirmation', {
      title: 'Order Confirmed',
      order,
      paymentInstructions: bankTransfer ? bankTransfer.instructions : (paymentConfig ? paymentConfig.instructions : null),
      bankDetails: bankTransfer ? bankTransfer.config : null
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not load order confirmation.');
    res.redirect('/');
  }
});

// POST /checkout/confirmation/:id/payment-proof - Bank Transfer only:
// customer submits their transaction reference and (optionally) a receipt
// file after completing the transfer. Never changes paymentStatus — that
// stays 'Pending Verification' until Phase 4 admin verification exists.
router.post('/confirmation/:id/payment-proof', isLoggedIn, (req, res) => {
  uploadReceipt.single('paymentProof')(req, res, async function (uploadErr) {
    const redirectBack = () => res.redirect(`/checkout/confirmation/${req.params.id}`);

    try {
      const order = await Order.findById(req.params.id);

      if (!order || order.user.toString() !== req.session.userId.toString()) {
        req.flash('error', 'Order not found.');
        return res.redirect('/');
      }

      if (order.paymentMethod !== 'Bank Transfer') {
        req.flash('error', 'Payment proof submission is only available for Bank Transfer orders.');
        return redirectBack();
      }

      if (uploadErr) {
        if (uploadErr.code === 'LIMIT_FILE_SIZE') {
          req.flash('error', 'Receipt file is too large. Maximum size is 5MB.');
        } else {
          req.flash('error', uploadErr.message || 'Could not upload receipt. Please check the file and try again.');
        }
        return redirectBack();
      }

      const transactionReference = (req.body.transactionReference || '').trim();
      if (!transactionReference) {
        req.flash('error', 'Please enter your transaction reference number.');
        return redirectBack();
      }
      if (transactionReference.length < TRANSACTION_REFERENCE_MIN_LENGTH || transactionReference.length > TRANSACTION_REFERENCE_MAX_LENGTH) {
        req.flash('error', `Transaction reference must be between ${TRANSACTION_REFERENCE_MIN_LENGTH} and ${TRANSACTION_REFERENCE_MAX_LENGTH} characters.`);
        return redirectBack();
      }

      order.set(recordPaymentProof({
        transactionReference,
        paymentProofFilename: req.file ? req.file.filename : null
      }));
      // A previous rejection leaves paymentStatus at 'Failed' with no way
      // back into admin review — resubmitting a receipt is exactly the
      // "customer can upload a new payment receipt" flow, so it re-opens
      // the order for verification and clears the old rejection reason.
      if (order.paymentStatus === 'Failed') {
        order.paymentStatus = 'Pending Verification';
        order.paymentRejectionReason = '';
      }
      await order.save();

      req.flash('success', 'Payment details submitted. We will verify your transfer shortly.');
      redirectBack();
    } catch (err) {
      console.error('Payment proof submission failed:', err);
      req.flash('error', 'Something went wrong while submitting your payment details. Please try again.');
      redirectBack();
    }
  });
});

// GET /checkout/confirmation/:id/receipt - serves an uploaded payment
// receipt. Owner-only: checks the order belongs to the logged-in customer
// before streaming the file, since receipts may contain sensitive
// financial information and are never stored under public/.
router.get('/confirmation/:id/receipt', isLoggedIn, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order || order.user.toString() !== req.session.userId.toString() || !order.paymentProof) {
      return res.status(404).send('Not found.');
    }

    const filePath = path.join(getReceiptUploadDir(), order.paymentProof);
    res.sendFile(filePath, function (err) {
      if (err && !res.headersSent) {
        console.error('Failed to send receipt file:', err);
        res.status(404).send('Receipt file not found.');
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
