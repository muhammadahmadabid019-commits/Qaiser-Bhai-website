const express = require('express');
const router = express.Router();
const path = require('path');
const Order = require('../../models/Order');
const {
  getActionButtons,
  shipOrder,
  deliverOrder,
  cancelOrder,
  approvePayment,
  rejectPayment
} = require('../../services/orderWorkflowService');

// Payment receipts live outside public/ (see routes/checkout.js for the
// customer-facing upload). This constant is intentionally duplicated here
// rather than imported from routes/checkout.js, so this admin module has
// zero dependency on — and zero risk of affecting — the customer checkout
// flow file.
function getReceiptUploadDir() {
  return process.env.NODE_ENV === 'production'
    ? '/tmp/receipts'
    : path.join(__dirname, '../../uploads/receipts');
}

// GET /admin/orders - paginated list
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 15;
    const skip = (page - 1) * limit;

    const totalOrders = await Order.countDocuments();
    const totalPages = Math.max(Math.ceil(totalOrders / limit), 1);

    const orders = await Order.find()
      .sort('-createdAt')
      .skip(skip)
      .limit(limit);

    res.render('admin/orders/index', {
      title: 'Manage Orders',
      orders,
      currentPage: page,
      totalPages
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// GET /admin/orders/:id - full order detail
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('items.product', 'name image slug')
      .populate('paymentApprovedBy', 'name email');
    if (!order) {
      req.flash('error', 'Order not found.');
      return res.redirect('/admin/orders');
    }

    const otherOrders = await Order.find({ user: order.user, _id: { $ne: order._id } })
      .sort('-createdAt')
      .limit(5);

    res.render('admin/orders/show', {
      title: `Order #${order._id.toString().slice(-8).toUpperCase()}`,
      order,
      otherOrders,
      workflow: getActionButtons(order)
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not load order.');
    res.redirect('/admin/orders');
  }
});

// Shared error handling for every action route below: each one calls a
// services/orderWorkflowService.js function, which throws ORDER_NOT_FOUND
// or INVALID_ACTION (e.g. a replayed/forged POST trying to ship an order
// that's already Delivered) instead of silently doing nothing.
function handleActionError(err, req, res) {
  console.error(err);
  if (err.code === 'ORDER_NOT_FOUND') {
    req.flash('error', 'Order not found.');
    return res.redirect('/admin/orders');
  }
  if (err.code === 'INVALID_ACTION') {
    req.flash('error', err.message);
    return res.redirect(`/admin/orders/${req.params.id}`);
  }
  req.flash('error', 'Something went wrong while updating this order.');
  res.redirect(`/admin/orders/${req.params.id}`);
}

// POST /admin/orders/:id/ship
router.post('/:id/ship', async (req, res) => {
  try {
    await shipOrder(req.params.id, req.session.userId);
    req.flash('success', 'Order marked as shipped.');
    res.redirect(`/admin/orders/${req.params.id}`);
  } catch (err) {
    handleActionError(err, req, res);
  }
});

// POST /admin/orders/:id/deliver
router.post('/:id/deliver', async (req, res) => {
  try {
    await deliverOrder(req.params.id, req.session.userId);
    req.flash('success', 'Order marked as delivered.');
    res.redirect(`/admin/orders/${req.params.id}`);
  } catch (err) {
    handleActionError(err, req, res);
  }
});

// POST /admin/orders/:id/cancel
router.post('/:id/cancel', async (req, res) => {
  try {
    await cancelOrder(req.params.id, req.session.userId);
    req.flash('success', 'Order cancelled. Inventory has been restored.');
    res.redirect(`/admin/orders/${req.params.id}`);
  } catch (err) {
    handleActionError(err, req, res);
  }
});

// POST /admin/orders/:id/verify-payment - approve/reject a Bank Transfer
// payment. Approving cascades the order status to 'Processing'; rejecting
// leaves fulfillment status at 'Pending' (the customer resubmits a receipt
// via routes/checkout.js, which re-opens this for review).
router.post('/:id/verify-payment', async (req, res) => {
  try {
    const { action } = req.body;
    if (!['approve', 'reject'].includes(action)) {
      req.flash('error', 'Invalid verification action.');
      return res.redirect(`/admin/orders/${req.params.id}`);
    }

    if (action === 'approve') {
      await approvePayment(req.params.id, req.session.userId);
      req.flash('success', 'Payment approved. Order moved to Processing.');
    } else {
      const reason = (req.body.reason || '').trim();
      if (!reason) {
        req.flash('error', 'Please provide a reason for rejecting this payment.');
        return res.redirect(`/admin/orders/${req.params.id}`);
      }
      await rejectPayment(req.params.id, req.session.userId, reason);
      req.flash('success', 'Payment rejected.');
    }

    res.redirect(`/admin/orders/${req.params.id}`);
  } catch (err) {
    handleActionError(err, req, res);
  }
});

// GET /admin/orders/:id/receipt - view an uploaded payment receipt.
// Access here is scoped by the isAdmin middleware applied when this router
// is mounted in server.js, not by order ownership (unlike the customer-
// facing route in routes/checkout.js).
router.get('/:id/receipt', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order || !order.paymentProof) {
      return res.status(404).send('Not found.');
    }

    const filePath = path.join(getReceiptUploadDir(), order.paymentProof);
    res.sendFile(filePath, function (err) {
      if (err && !res.headersSent) {
        console.error('Failed to send receipt file:', err);
        res.status(404).send('Receipt file not found.');
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
