// Order retention logic — single source of truth for computing expiry dates,
// fetching/saving the admin retention setting, and bulk-updating existing
// terminal orders when the setting changes. Follows the same separation-of-
// concerns pattern as paymentSettingsService.js and orderWorkflowService.js.

const Order = require('../models/Order');
const OrderRetentionSettings = require('../models/OrderRetentionSettings');
const { ALLOWED_RETENTION_MONTHS, DEFAULT_RETENTION_MONTHS } = OrderRetentionSettings;

// The only two statuses after which an order's retention countdown begins.
// Derived from orderWorkflowService.getOrderWorkflow: the states that return
// { actionKeys: [] } — i.e., states with nothing left to do.
const TERMINAL_STATUSES = ['Delivered', 'Cancelled'];

// ──────────────────────────────────────────────────────────────────────────
// Settings access
// ──────────────────────────────────────────────────────────────────────────

// Always returns a fully-populated settings object — even before an admin
// has explicitly saved anything — so callers never need to null-check.
async function getRetentionSettings() {
  const doc = await OrderRetentionSettings.findOne({ key: 'order_retention' });
  if (!doc) {
    return {
      retentionMonths: DEFAULT_RETENTION_MONTHS,
      autoDelete: true
    };
  }
  return {
    retentionMonths: doc.retentionMonths,
    autoDelete: doc.autoDelete
  };
}

// Creates the settings document on first save, updates it thereafter.
// Validates retentionMonths against the enum rather than trusting the caller.
// Returns the count of existing terminal orders that were updated as a side
// effect, so the calling route can surface this to the admin.
async function saveRetentionSettings({ retentionMonths, autoDelete }) {
  const months = parseInt(retentionMonths, 10);
  if (!ALLOWED_RETENTION_MONTHS.includes(months)) {
    const err = new Error(
      `Invalid retention period: ${retentionMonths}. Allowed values: ${ALLOWED_RETENTION_MONTHS.join(', ')} months.`
    );
    err.code = 'INVALID_RETENTION_MONTHS';
    throw err;
  }

  const enabled = Boolean(autoDelete);

  await OrderRetentionSettings.findOneAndUpdate(
    { key: 'order_retention' },
    { $set: { retentionMonths: months, autoDelete: enabled } },
    { upsert: true, setDefaultsOnInsert: true }
  );

  // Propagate the new setting to all existing terminal orders.
  // Active orders are safe because they do not have a terminal status.
  const updatedCount = await recomputeExistingTerminalOrders(months, enabled);
  return updatedCount;
}

// ──────────────────────────────────────────────────────────────────────────
// Date computation
// ──────────────────────────────────────────────────────────────────────────

// Adds `months` calendar months to `anchorDate`. JavaScript Date.setMonth
// handles end-of-month edge cases naturally (e.g. Jan 31 + 1 = Feb 28/29).
function computeExpiresAt(anchorDate, months) {
  const d = new Date(anchorDate);
  d.setMonth(d.getMonth() + months);
  return d;
}

// Given an order, returns the Date at which it entered its terminal state.
// Prefers the last matching statusHistory entry; falls back to updatedAt
// for orders that predated statusHistory or had no entry recorded.
function resolveTerminalDate(order) {
  if (order.statusHistory && order.statusHistory.length > 0) {
    // Walk backwards — the last entry for a terminal status is the one we want
    for (let i = order.statusHistory.length - 1; i >= 0; i--) {
      if (TERMINAL_STATUSES.includes(order.statusHistory[i].status)) {
        return new Date(order.statusHistory[i].changedAt);
      }
    }
  }
  // Fallback: use updatedAt (always present because of { timestamps: true })
  return new Date(order.updatedAt);
}

// ──────────────────────────────────────────────────────────────────────────
// Setting expiresAt on a single order (called by orderWorkflowService)
// ──────────────────────────────────────────────────────────────────────────

// Sets order.expiresAt when autoDelete is enabled, clears it otherwise.
// Does NOT call order.save() — the caller (orderWorkflowService) already
// saves the order as part of its own transaction/save cycle.
// `terminalDate` is the timestamp of the status change, passed in by the
// caller so we use the exact moment of the transition, not "now".
async function applyRetentionToOrder(order, terminalDate) {
  const settings = await getRetentionSettings();
  if (settings.autoDelete) {
    order.expiresAt = computeExpiresAt(terminalDate, settings.retentionMonths);
  } else {
    order.expiresAt = null;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Bulk update on setting change
// ──────────────────────────────────────────────────────────────────────────

// When the admin changes the retention period or toggles autoDelete, this
// function propagates the change to all existing terminal orders.
// Active orders are ignored because they do not have a terminal status.
// Uses bulkWrite for efficiency — avoids a separate round-trip per order.
async function recomputeExistingTerminalOrders(newRetentionMonths, autoDeleteEnabled) {
  // Select all terminal orders so that if Auto-delete is turned ON,
  // previously unenrolled terminal orders (expiresAt: null) can be enrolled.
  const terminalOrders = await Order.find({
    status: { $in: TERMINAL_STATUSES }
  }).lean();

  if (terminalOrders.length === 0) return 0;

  const bulkOps = terminalOrders.map(order => {
    const terminalDate = resolveTerminalDate(order);
    const newExpiresAt = autoDeleteEnabled
      ? computeExpiresAt(terminalDate, newRetentionMonths)
      : null;

    return {
      updateOne: {
        filter: { _id: order._id },
        update: { $set: { expiresAt: newExpiresAt } }
      }
    };
  });

  await Order.bulkWrite(bulkOps);
  return bulkOps.length;
}

module.exports = {
  TERMINAL_STATUSES,
  ALLOWED_RETENTION_MONTHS,
  DEFAULT_RETENTION_MONTHS,
  getRetentionSettings,
  saveRetentionSettings,
  computeExpiresAt,
  resolveTerminalDate,
  applyRetentionToOrder,
  recomputeExistingTerminalOrders
};
