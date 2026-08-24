// Payment settings logic, kept separate from checkout/order/admin routes —
// same separation-of-concerns pattern as services/paymentService.js and
// services/inventoryService.js. This is the one place that knows how to
// read/write a payment method's admin-configurable settings; every future
// payment method (Easypaisa, JazzCash, Card) reuses these same functions
// unchanged, only passing a different `method` string and `config` shape.

const PaymentSettings = require('../models/PaymentSettings');

// Safe, obviously-placeholder defaults — never real-looking fake account
// data. Shown only until an admin actually saves real settings (or if the
// Bank Transfer document doesn't exist yet on a fresh install), matching
// the same principle the original config/bankTransferDetails.js used.
const BANK_TRANSFER_CONFIG_DEFAULTS = {
  bankName: '[Bank Name Not Yet Configured]',
  accountTitle: '[Account Title Not Yet Configured]',
  accountNumber: '[Account Number Not Yet Configured]',
  iban: '[IBAN Not Yet Configured]',
  branch: ''
};
const DEFAULT_INSTRUCTIONS =
  'Please transfer the exact order amount. After completing the transfer, upload your payment receipt and enter your transaction reference number. Your payment will be reviewed by our team before the order is processed.';

async function getMethodSettings(method) {
  return PaymentSettings.findOne({ method });
}

// Convenience wrapper for the one method this phase actually builds admin
// UI for. Always returns a fully-populated object — even before an admin
// has saved anything — so callers (checkout, confirmation page) never have
// to null-check.
async function getBankTransferSettings() {
  const doc = await getMethodSettings('Bank Transfer');
  if (!doc) {
    return {
      enabled: true,
      instructions: DEFAULT_INSTRUCTIONS,
      config: BANK_TRANSFER_CONFIG_DEFAULTS
    };
  }
  return {
    enabled: doc.enabled,
    instructions: doc.instructions || DEFAULT_INSTRUCTIONS,
    config: Object.assign({}, BANK_TRANSFER_CONFIG_DEFAULTS, doc.config || {})
  };
}

// Creates the document on first save, updates it thereafter — the admin
// settings route doesn't need to know or care which.
async function upsertMethodSettings(method, { enabled, instructions, config }) {
  return PaymentSettings.findOneAndUpdate(
    { method },
    { $set: { enabled, instructions, config } },
    { upsert: true, setDefaultsOnInsert: true, returnDocument: 'after' }
  );
}

module.exports = {
  getMethodSettings,
  getBankTransferSettings,
  upsertMethodSettings,
  BANK_TRANSFER_CONFIG_DEFAULTS
};
