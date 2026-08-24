const AppSettings = require('../models/AppSettings');

const getAppSettings = async () => {
  let settings = await AppSettings.findOne({ key: 'global_settings' });
  if (!settings) {
    settings = await AppSettings.create({ key: 'global_settings' });
  }
  return settings;
};

const updateWhatsAppBookingEnabled = async (enabled) => {
  return AppSettings.findOneAndUpdate(
    { key: 'global_settings' },
    { whatsappBookingEnabled: enabled },
    { upsert: true, new: true }
  );
};

module.exports = {
  getAppSettings,
  updateWhatsAppBookingEnabled
};
