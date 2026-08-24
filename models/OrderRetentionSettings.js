const mongoose = require('mongoose');

// Allowed retention period values (months). Enforced at the model level so
// an invalid value can never be saved — not even via a direct DB write.
const ALLOWED_RETENTION_MONTHS = [3, 6, 12, 18, 24];
const DEFAULT_RETENTION_MONTHS = 12;

// Single-document settings store for order retention, following the same
// one-document-per-purpose singleton pattern as PaymentSettings. Only one
// document is ever created; the service layer always uses findOneAndUpdate
// with { upsert: true } so callers never have to worry about bootstrapping.
const orderRetentionSettingsSchema = new mongoose.Schema({
  // Human-readable key so the document is identifiable without relying on
  // a magic ObjectId — same pattern as PaymentSettings.method.
  key: {
    type: String,
    default: 'order_retention',
    unique: true,
    immutable: true
  },

  // Number of months to retain a terminal order (Delivered / Cancelled)
  // before MongoDB's TTL mechanism removes it automatically.
  retentionMonths: {
    type: Number,
    enum: ALLOWED_RETENTION_MONTHS,
    default: DEFAULT_RETENTION_MONTHS
  },

  // When true, expiresAt is set on orders that reach a terminal status,
  // enabling automatic TTL deletion. When false, expiresAt is left null
  // for newly terminal orders (existing expiresAt values are cleared on
  // the next retention-setting save).
  autoDelete: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('OrderRetentionSettings', orderRetentionSettingsSchema);
module.exports.ALLOWED_RETENTION_MONTHS = ALLOWED_RETENTION_MONTHS;
module.exports.DEFAULT_RETENTION_MONTHS = DEFAULT_RETENTION_MONTHS;
