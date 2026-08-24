const mongoose = require('mongoose');

// Single-document settings store for global application settings.
// Follows the same pattern as OrderRetentionSettings.
const appSettingsSchema = new mongoose.Schema({
  key: {
    type: String,
    default: 'global_settings',
    unique: true,
    immutable: true
  },
  whatsappBookingEnabled: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('AppSettings', appSettingsSchema);
