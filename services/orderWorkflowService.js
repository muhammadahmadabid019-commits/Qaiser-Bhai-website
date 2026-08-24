// Order fulfillment workflow, kept separate from routes/admin/orders.js —
// same separation-of-concerns pattern as services/paymentService.js and
// services/inventoryService.js. This is the single source of truth for
// which business actions ("Ship Order", "Cancel Order", ...) are legal for
// an order's *current* state, used both to decide which buttons the admin
// panel renders and, in every action function below, to reject an action
// the current state doesn't actually allow. That second check is what
// makes replaying/forging a POST safe — an order that's already Delivered
// simply has no legal actions left, whether the click came from a real
// button or a hand-crafted request.
//
// Deliberately replaces free-form "set status to X" (the old dropdown) —
// admins now perform business actions, and the resulting status is a
// side-effect of the action rather than something typed in directly. This
// is also why 'Processing' never appears in ACTION_DEFINITIONS as a
// destination an admin picks: it only exists as the automatic result of
// approving a Bank Transfer payment.

const mongoose = require('mongoose');
const Order = require('../models/Order');
const { restoreStockForItems } = require('./inventoryService');
const emailService = require('./emailService');
const { applyRetentionToOrder } = require('./orderRetentionService');

// Statuses after which inventory has already physically left — cancelling
// from these should not restore stock (matches the original /status
// route's NO_RESTORE_STATUSES, carried over unchanged).
const NO_RESTORE_STATUSES = ['Shipped', 'Delivered'];

const ACTION_DEFINITIONS = {
  approvePayment: {
    label: 'Approve Payment',
    icon: 'fa-check',
    btnClass: 'btn-success',
    confirmMessage: 'Approve this payment? This will mark it as Paid and move the order to Processing.'
  },
  rejectPayment: {
    label: 'Reject Payment',
    icon: 'fa-times',
    btnClass: 'btn-outline-danger',
    requiresReason: true,
    confirmMessage: 'Reject this payment? The customer will be asked to resubmit their payment details.'
  },
  ship: {
    label: 'Ship Order',
    icon: 'fa-truck',
    btnClass: 'btn-primary',
    confirmMessage: 'Mark this order as shipped?'
  },
  deliver: {
    label: 'Mark as Delivered',
    icon: 'fa-box-open',
    btnClass: 'btn-success',
    confirmMessage: 'Mark this order as delivered?'
  },
  cancel: {
    label: 'Cancel Order',
    icon: 'fa-ban',
    btnClass: 'btn-outline-danger',
    confirmMessage: 'Are you sure you want to cancel this order? This cannot be undone.'
  }
};

// Given an order's current (paymentMethod, paymentStatus, status), returns
// which action keys are legal right now, plus a terminal `display` label
// when there's nothing left to do. This is the entire state machine in one
// place — every other function in this file defers to it.
function getOrderWorkflow(order) {
  const { paymentMethod, paymentStatus, status } = order;

  if (status === 'Cancelled') return { display: 'Cancelled', actionKeys: [] };
  if (status === 'Delivered') return { display: 'Completed', actionKeys: [] };
  if (status === 'Shipped') return { display: null, actionKeys: ['deliver'] };
  // Processing also allows Cancel (not just Ship) — a Bank Transfer order
  // whose payment was just approved can still be cancelled before it
  // ships; inventory restoration below already excludes Shipped/Delivered,
  // so this stays safe with the "restore only once" rule.
  if (status === 'Processing') return { display: null, actionKeys: ['ship', 'cancel'] };

  // status === 'Pending' from here down
  if (paymentMethod === 'Bank Transfer' && paymentStatus === 'Pending Verification') {
    return { display: null, actionKeys: ['approvePayment', 'rejectPayment', 'cancel'] };
  }
  if (paymentMethod === 'Bank Transfer' && paymentStatus === 'Failed') {
    // Payment was rejected; the customer needs to resubmit a receipt
    // before this order can be reviewed again (see routes/checkout.js,
    // which resets paymentStatus back to 'Pending Verification' on
    // resubmission). Nothing to approve/reject yet — only cancellation
    // is meaningful here.
    return { display: null, actionKeys: ['cancel'], note: 'Awaiting the customer to resubmit payment details.' };
  }
  // Cash on Delivery (or any other offline method) at Pending
  return { display: null, actionKeys: ['ship', 'cancel'] };
}

// View-ready version of getOrderWorkflow: expands each action key into its
// full button descriptor (label/icon/class/confirm text).
function getActionButtons(order) {
  const workflow = getOrderWorkflow(order);
  return {
    display: workflow.display,
    note: workflow.note || null,
    actions: workflow.actionKeys.map(key => ({ key, ...ACTION_DEFINITIONS[key] }))
  };
}

function notFoundError() {
  return Object.assign(new Error('Order not found.'), { code: 'ORDER_NOT_FOUND' });
}

function invalidActionError(actionKey) {
  return Object.assign(
    new Error(`"${ACTION_DEFINITIONS[actionKey] ? ACTION_DEFINITIONS[actionKey].label : actionKey}" is not available for this order's current state.`),
    { code: 'INVALID_ACTION' }
  );
}

function assertActionAllowed(order, actionKey) {
  const { actionKeys } = getOrderWorkflow(order);
  if (!actionKeys.includes(actionKey)) {
    throw invalidActionError(actionKey);
  }
}

// POST /admin/orders/:id/ship
async function shipOrder(orderId, changedBy) {
  const order = await Order.findById(orderId);
  if (!order) throw notFoundError();
  assertActionAllowed(order, 'ship');

  order.status = 'Shipped';
  order.statusHistory.push({ status: 'Shipped', changedAt: new Date(), changedBy });
  await order.save();

  // Email is best-effort: the order status change above already committed,
  // so a failed/slow email must never surface as a failed "ship" action.
  try {
    await emailService.sendOrderShipped(order);
  } catch (err) {
    console.error(`[orderWorkflowService] sendOrderShipped failed for order ${order._id}:`, err);
  }
  return order;
}

// POST /admin/orders/:id/deliver
async function deliverOrder(orderId, changedBy) {
  const order = await Order.findById(orderId);
  if (!order) throw notFoundError();
  assertActionAllowed(order, 'deliver');

  const terminalDate = new Date();
  order.status = 'Delivered';
  if (order.paymentMethod === 'Cash on Delivery') {
    order.paymentStatus = 'Paid';
  }
  order.statusHistory.push({ status: 'Delivered', changedAt: terminalDate, changedBy });

  // Set expiresAt based on the current admin retention setting. Best-effort:
  // a failure here must not block the status change — the order is still
  // delivered, just without a TTL date (it stays in the DB until manually
  // cleaned or the setting is re-saved).
  try {
    await applyRetentionToOrder(order, terminalDate);
  } catch (retentionErr) {
    console.error(`[orderWorkflowService] retention apply failed for order ${order._id}:`, retentionErr);
  }

  await order.save();

  try {
    await emailService.sendOrderDelivered(order);
  } catch (err) {
    console.error(`[orderWorkflowService] sendOrderDelivered failed for order ${order._id}:`, err);
  }
  return order;
}

// POST /admin/orders/:id/cancel — restores inventory in the same
// transaction as the status change (mirrors the original /status route),
// so the two can never end up out of sync. Restoration is inherently
// exactly-once: an already-Cancelled order has no 'cancel' action left in
// getOrderWorkflow, so assertActionAllowed rejects a second attempt before
// any stock is touched.
async function cancelOrder(orderId, changedBy) {
  const session = await mongoose.startSession();
  let order;
  try {
    await session.withTransaction(async () => {
      order = await Order.findById(orderId).session(session);
      if (!order) throw notFoundError();
      assertActionAllowed(order, 'cancel');

      if (!NO_RESTORE_STATUSES.includes(order.status)) {
        await restoreStockForItems(
          order.items.map(item => ({ productId: item.product, quantity: item.quantity })),
          session
        );
      }

      const terminalDate = new Date();
      order.status = 'Cancelled';
      order.statusHistory.push({ status: 'Cancelled', changedAt: terminalDate, changedBy });

      // Apply retention inside the transaction so expiresAt is committed
      // atomically with the status change. Best-effort: a retention failure
      // must not abort the cancellation or stock restoration.
      try {
        await applyRetentionToOrder(order, terminalDate);
      } catch (retentionErr) {
        console.error(`[orderWorkflowService] retention apply failed for order ${order._id}:`, retentionErr);
      }

      await order.save({ session });
    });
  } finally {
    session.endSession();
  }

  try {
    await emailService.sendOrderCancelled(order);
  } catch (err) {
    console.error(`[orderWorkflowService] sendOrderCancelled failed for order ${order._id}:`, err);
  }
  return order;
}

// POST /admin/orders/:id/verify-payment (action=approve) — Bank Transfer only.
async function approvePayment(orderId, changedBy) {
  const order = await Order.findById(orderId);
  if (!order) throw notFoundError();
  assertActionAllowed(order, 'approvePayment');

  order.paymentStatus = 'Paid';
  order.paymentApprovedBy = changedBy;
  order.paymentApprovedAt = new Date();
  order.paymentRejectionReason = '';
  order.status = 'Processing';
  order.statusHistory.push({ status: 'Processing', changedAt: new Date(), changedBy, notes: 'Payment approved.' });
  await order.save();

  // Payment Verified is an internal/payment-status email, not one of the
  // customer-facing lifecycle emails this app currently sends — disabled
  // by request. emailService.sendPaymentVerified still exists and works
  // unchanged; re-enable by uncommenting the call below if the client
  // wants this email later.
  // try {
  //   await emailService.sendPaymentVerified(order);
  // } catch (err) {
  //   console.error(`[orderWorkflowService] sendPaymentVerified failed for order ${order._id}:`, err);
  // }
  return order;
}

// POST /admin/orders/:id/verify-payment (action=reject) — Bank Transfer
// only. Fulfillment `status` stays 'Pending' (it never left Pending), but
// we still record a statusHistory entry so who rejected it and why shows
// up in the audit trail, not just on the payment fields.
async function rejectPayment(orderId, changedBy, reason) {
  const order = await Order.findById(orderId);
  if (!order) throw notFoundError();
  assertActionAllowed(order, 'rejectPayment');

  order.paymentStatus = 'Failed';
  order.paymentRejectionReason = reason;
  order.statusHistory.push({ status: 'Pending', changedAt: new Date(), changedBy, notes: `Payment rejected: ${reason}` });
  await order.save();

  // Payment Rejected is disabled for the same reason as Payment Verified
  // above — internal/payment-status email, not currently sent to
  // customers. emailService.sendPaymentRejected is untouched; re-enable by
  // uncommenting the call below if needed later.
  // try {
  //   await emailService.sendPaymentRejected(order);
  // } catch (err) {
  //   console.error(`[orderWorkflowService] sendPaymentRejected failed for order ${order._id}:`, err);
  // }
  return order;
}

module.exports = {
  getOrderWorkflow,
  getActionButtons,
  shipOrder,
  deliverOrder,
  cancelOrder,
  approvePayment,
  rejectPayment
};
