const express = require('express');
const router = express.Router();

// Customer-facing My Orders pages are disabled.
// WhatsApp orders are not stored as DB Orders, so this page would confuse customers.
// Admin Orders remain fully available at /admin/orders.
router.get('/', (req, res) => res.redirect('/'));
router.get('/:id', (req, res) => res.redirect('/'));

module.exports = router;
