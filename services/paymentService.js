// Payment logic, kept separate from order-creation logic (routes/checkout.js)
// so that payment handling can evolve — new providers, real gateway calls,
// async confirmation — without routes/checkout.js or models/Order.js needing
// to change.
//
// initializePayment() is the seam a future real integration plugs into.
// Today every method is either offline (COD, Bank Transfer) or an
// unintegrated "online" placeholder (Easypaisa/JazzCash/Card), so this stays
// a synchronous lookup against data/paymentMethods.js and every order's
// paymentStatus starts at that method's configured initial status ('Pending'
// or 'Pending Verification' — never 'Paid', since nothing has actually been
// verified yet).
//
// When a real gateway is added for an `online` method, this function is
// where that would happen: it would become async, call out to the
// provider's API/SDK, and return 'Paid' or 'Failed' based on the actual
// gateway response instead of always returning the configured default.

const { getPaymentMethodConfig, isValidPaymentMethod } = require('../data/paymentMethods');

function initializePayment(paymentMethod, { paymentAccountNumber } = {}) {
  if (!isValidPaymentMethod(paymentMethod)) {
    throw new Error(`Unsupported payment method: ${paymentMethod}`);
  }

  const config = getPaymentMethodConfig(paymentMethod);

  return {
    paymentMethod,
    paymentStatus: config.initialPaymentStatus,
    paymentAccountNumber: (config.requiresAccountNumber && paymentAccountNumber)
      ? paymentAccountNumber.trim()
      : undefined,
    transactionReference: ''
  };
}

// Builds the fields to update on an existing order once a customer submits
// their transaction reference (and optionally a receipt file) after
// placing a Bank Transfer order. Deliberately does NOT touch paymentStatus
// — it stays 'Pending Verification' until a human (Phase 4 admin panel) or
// a future gateway callback confirms it, matching this phase's scope.
//
// `paymentProofFilename` is omitted from the returned object entirely when
// no new file was uploaded, so callers can safely do
// `order.set(recordPaymentProof(...))` without accidentally clearing a
// previously-uploaded receipt on a resubmission that only updates the
// reference number.
function recordPaymentProof({ transactionReference, paymentProofFilename }) {
  const update = {
    transactionReference: transactionReference.trim(),
    paymentSubmittedAt: new Date()
  };
  if (paymentProofFilename) {
    update.paymentProof = paymentProofFilename;
  }
  return update;
}

module.exports = { initializePayment, recordPaymentProof };
