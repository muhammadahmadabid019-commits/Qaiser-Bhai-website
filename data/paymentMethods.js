// Canonical registry of payment methods, in PKR e-commerce context. This is
// the single source of truth for which payment methods exist — the Order
// schema's enum, checkout's server-side validation, and payment
// initialization all derive from this file instead of each hardcoding
// their own copy of the list (the same class of drift bug fixed for
// shipping fees and city names in earlier phases).
//
// `offline` methods are ones this app can already accept today without a
// payment gateway (cash, manual bank transfer). `online` methods need a
// real gateway integration before they can be trusted — until then they're
// accepted the same way COD is: the order is created, payment is settled
// out-of-band (currently: a phone call), and paymentStatus stays 'Pending'.
// When a real gateway is wired up for one of these, only its
// `initialPaymentStatus` / integration behavior needs to change here and
// in services/paymentService.js — checkout and order-creation logic do not
// need to change.

const PAYMENT_METHODS = {
  'Cash on Delivery': {
    key: 'Cash on Delivery',
    label: 'Cash on Delivery',
    type: 'offline',
    requiresAccountNumber: false,
    initialPaymentStatus: 'Pending',
    instructions: null
  },
  'Bank Transfer': {
    key: 'Bank Transfer',
    label: 'Bank Transfer',
    type: 'offline',
    requiresAccountNumber: false,
    initialPaymentStatus: 'Pending Verification',
    instructions: 'Please complete your bank transfer using the account details below, then submit your transaction details for verification.'
  }
  // Easypaisa, JazzCash, and Debit/Credit Card were removed from checkout
  // (2026-08-02) — none had a real gateway integration behind them. The
  // architecture (this registry, models/PaymentSettings.js, the
  // `requiresAccountNumber`/paymentAccountNumber plumbing in
  // routes/checkout.js and services/paymentService.js) was built generic
  // specifically so any of these can be added back later by adding an
  // entry here — no other file needs to change.
};

function getPaymentMethodKeys() {
  return Object.keys(PAYMENT_METHODS);
}

function isValidPaymentMethod(key) {
  return Object.prototype.hasOwnProperty.call(PAYMENT_METHODS, key);
}

function getPaymentMethodConfig(key) {
  return PAYMENT_METHODS[key];
}

module.exports = {
  PAYMENT_METHODS,
  getPaymentMethodKeys,
  isValidPaymentMethod,
  getPaymentMethodConfig
};
