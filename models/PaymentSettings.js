const mongoose = require('mongoose');
const { getPaymentMethodKeys } = require('../data/paymentMethods');

// One document per payment method — deliberately generic so Easypaisa,
// JazzCash, and Card Payment can reuse this exact same model later without
// any schema change: only `config` (a free-form object) actually differs
// per method (Bank Transfer needs bankName/accountNumber/iban; a mobile
// wallet would need something else entirely). Today only a 'Bank Transfer'
// document is ever created/used — this phase does not build admin UI for
// the other methods, per the task's explicit scope.
const PaymentSettingsSchema = new mongoose.Schema({
  method: {
    type: String,
    enum: getPaymentMethodKeys(),
    required: true,
    unique: true
  },
  enabled: {
    type: Boolean,
    default: true
  },
  instructions: {
    type: String,
    trim: true,
    default: ''
  },
  // Method-specific fields live here rather than as top-level schema
  // fields, so adding a new payment method never requires a migration —
  // e.g. Bank Transfer's config: { bankName, accountTitle, accountNumber,
  // iban, branch }.
  config: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { timestamps: true });

module.exports = mongoose.model('PaymentSettings', PaymentSettingsSchema);
