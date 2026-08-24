const express = require('express');
const router = express.Router();
const { getBankTransferSettings, upsertMethodSettings } = require('../../services/paymentSettingsService');
const { getAppSettings, updateWhatsAppBookingEnabled } = require('../../services/appSettingsService');

// GET /admin/payment-settings - edit form for Bank Transfer. Only this one
// method has admin UI in this phase; the underlying model/service already
// supports adding Easypaisa/JazzCash/Card the same way later.
router.get('/', async (req, res) => {
  try {
    const bankTransfer = await getBankTransferSettings();
    const appSettings = await getAppSettings();
    res.render('admin/paymentSettings/edit', {
      title: 'Payment Settings',
      bankTransfer,
      appSettings
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not load payment settings.');
    res.redirect('/admin/dashboard');
  }
});

// POST /admin/payment-settings/bank-transfer - update Bank Transfer settings
router.post('/bank-transfer', async (req, res) => {
  try {
    const {
      bankName, accountTitle, accountNumber, iban, branch,
      instructions, enabled
    } = req.body;

    await upsertMethodSettings('Bank Transfer', {
      enabled: enabled === 'on',
      instructions: (instructions || '').trim(),
      config: {
        bankName: (bankName || '').trim(),
        accountTitle: (accountTitle || '').trim(),
        accountNumber: (accountNumber || '').trim(),
        iban: (iban || '').trim(),
        branch: (branch || '').trim()
      }
    });

    req.flash('success', 'Bank Transfer settings updated successfully.');
    res.redirect('/admin/payment-settings');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to update Bank Transfer settings.');
    res.redirect('/admin/payment-settings');
  }
});

// POST /admin/payment-settings/whatsapp - update global WhatsApp toggle
router.post('/whatsapp', async (req, res) => {
  try {
    const { whatsappBookingEnabled } = req.body;
    // Explicitly persist boolean based on checkbox submission
    await updateWhatsAppBookingEnabled(whatsappBookingEnabled === 'on');
    
    req.flash('success', 'WhatsApp Settings updated successfully.');
    res.redirect('/admin/payment-settings');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to update WhatsApp settings.');
    res.redirect('/admin/payment-settings');
  }
});

module.exports = router;
