const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const { isLoggedIn } = require('../middlewares/auth');

const FULFILLMENT_SEQUENCE = ['Processing', 'Shipped', 'Delivered'];

// Builds the timeline steps for the order detail page. Only uses real,
// stored timestamps (order.createdAt, order.paymentSubmittedAt,
// order.statusHistory) — never fabricates a time for a transition that
// wasn't actually recorded (e.g. orders that predate the statusHistory
// field simply show that step as reached, with no timestamp).
function buildTimeline(order) {
  const findHistoryTime = (status) => {
    const entries = (order.statusHistory || []).filter(h => h.status === status);
    return entries.length ? entries[entries.length - 1].changedAt : null;
  };

  const steps = [
    { label: 'Order Placed', timestamp: order.createdAt, state: 'completed' }
  ];

  if (order.paymentMethod === 'Bank Transfer') {
    let state = 'current';
    if (order.paymentStatus === 'Paid') state = 'completed';
    else if (order.paymentStatus === 'Failed') state = 'failed';
    steps.push({
      label: 'Payment Verification',
      sublabel: order.paymentStatus,
      timestamp: order.paymentSubmittedAt || null,
      state
    });
  }

  if (order.status === 'Cancelled') {
    FULFILLMENT_SEQUENCE.forEach(label => {
      steps.push({ label, timestamp: findHistoryTime(label), state: 'skipped' });
    });
    steps.push({ label: 'Cancelled', timestamp: findHistoryTime('Cancelled'), state: 'failed' });
  } else {
    const currentIdx = FULFILLMENT_SEQUENCE.indexOf(order.status); // -1 while still Pending
    const lastIdx = FULFILLMENT_SEQUENCE.length - 1;
    FULFILLMENT_SEQUENCE.forEach((label, i) => {
      let state = 'inactive';
      if (i < currentIdx) state = 'completed';
      // The final step (Delivered) is a terminal state, not an
      // in-progress one — once reached, it should read as completed
      // (checkmark), not "current" (there's nothing left to progress to).
      else if (i === currentIdx) state = (i === lastIdx) ? 'completed' : 'current';
      steps.push({ label, timestamp: findHistoryTime(label), state });
    });
  }

  return steps;
}

// Customer-facing My Orders pages are disabled.
// WhatsApp orders are not stored as DB Orders, so this page would confuse customers.
// Admin Orders remain fully available at /admin/orders.
router.get('/', (req, res) => res.redirect('/'));
router.get('/:id', (req, res) => res.redirect('/'));

module.exports = router;
