const express = require('express');
const router = express.Router();
const {
  getRetentionSettings,
  saveRetentionSettings,
  ALLOWED_RETENTION_MONTHS
} = require('../../services/orderRetentionService');

// GET /admin/order-retention - edit form for order retention settings
router.get('/', async (req, res) => {
  try {
    const settings = await getRetentionSettings();
    res.render('admin/orderRetentionSettings/edit', {
      title: 'Order Retention Settings',
      settings,
      allowedMonths: ALLOWED_RETENTION_MONTHS
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not load order retention settings.');
    res.redirect('/admin/dashboard');
  }
});

// POST /admin/order-retention - save retention period + auto-delete toggle
router.post('/', async (req, res) => {
  try {
    const { retentionMonths, autoDelete } = req.body;

    const updatedCount = await saveRetentionSettings({
      retentionMonths,
      autoDelete: autoDelete === 'on'
    });

    const msg = updatedCount > 0
      ? `Retention settings saved. ${updatedCount} existing terminal order(s) updated.`
      : 'Retention settings saved.';

    req.flash('success', msg);
    res.redirect('/admin/order-retention');
  } catch (err) {
    console.error(err);
    if (err.code === 'INVALID_RETENTION_MONTHS') {
      req.flash('error', err.message);
    } else {
      req.flash('error', 'Failed to save order retention settings.');
    }
    res.redirect('/admin/order-retention');
  }
});

module.exports = router;
