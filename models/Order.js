const mongoose = require('mongoose');
const { getPaymentMethodKeys } = require('../data/paymentMethods');

// Single source of truth for order status values — used by both the
// `status` field below and `statusHistory.status`, so they can never drift
// apart from each other.
const ORDER_STATUS_VALUES = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required']
  },
  items: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: [true, 'Product reference is required']
      },
      name: String,   // snapshot of product name at time of order
      price: Number,  // snapshot of unit price at time of order
      quantity: {
        type: Number,
        required: [true, 'Quantity is required'],
        min: [1, 'Quantity must be at least 1']
      }
    }
  ],

  // Contact info captured at checkout
  customerName: { type: String, trim: true },
  phone: { type: String, trim: true },
  email: { type: String, trim: true },

  // Structured delivery address
  shippingAddress: {
    houseNo: { type: String, trim: true },
    street: { type: String, trim: true },
    area: { type: String, trim: true },
    city: { type: String, trim: true },
    province: { type: String, trim: true },
    postalCode: { type: String, trim: true }
  },

  deliveryMethod: {
    type: String,
    enum: ['Standard', 'Express'],
    default: 'Standard'
  },
  deliveryFee: {
    type: Number,
    default: 0
  },

  paymentMethod: {
    type: String,
    enum: getPaymentMethodKeys(),
    default: 'Cash on Delivery'
  },
  // Only used for Easypaisa/JazzCash - a mobile account number, not sensitive card data
  paymentAccountNumber: { type: String, trim: true },

  // Separate from order fulfillment `status` below — this tracks whether
  // money has actually been received/verified, independent of whether the
  // order itself has been processed/shipped.
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Pending Verification', 'Paid', 'Failed'],
    default: 'Pending'
  },
  // Populated later (manually today, by a future gateway callback once
  // integrated) once a payment can actually be verified against a receipt.
  transactionReference: { type: String, trim: true, default: '' },
  // Stores only the uploaded receipt's filename, not a public URL — the
  // file lives outside public/ and is only ever served through an
  // authenticated route that checks order ownership (see routes/checkout.js).
  paymentProof: { type: String, trim: true, default: '' },
  // When the customer submitted their transaction reference/receipt.
  // Distinct from `updatedAt` so it's not overwritten by unrelated future
  // updates (e.g. an admin changing order status in Phase 4).
  paymentSubmittedAt: { type: Date, default: null },

  // Audit trail for the admin approve/reject decision — who and when.
  paymentApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  paymentApprovedAt: { type: Date, default: null },
  // Required when an admin rejects a payment; shown back to the customer.
  paymentRejectionReason: { type: String, trim: true, default: '' },

  subtotal: {
    type: Number,
    default: 0,
    min: 0
  },
  tax: {
    type: Number,
    default: 0,
    min: 0
  },
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total amount cannot be negative']
  },

  status: {
    type: String,
    enum: ORDER_STATUS_VALUES,
    default: 'Pending'
  },

  // Records every order-status change an admin makes, going forward —
  // existing orders simply have no entries before this field existed
  // (no historical backfill). Powers the customer-facing order timeline's
  // per-step timestamps. Does NOT record the initial 'Pending' state at
  // creation — that moment is already represented by `createdAt`.
  statusHistory: {
    type: [{
      status: { type: String, enum: ORDER_STATUS_VALUES, required: true },
      changedAt: { type: Date, default: Date.now },
      // Which admin performed this transition — null for entries recorded
      // before this field existed. Never set for the customer-driven
      // initial 'Pending' state (there's no admin action to attribute).
      changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      notes: { type: String, trim: true, default: '' },
      _id: false
    }],
    default: []
  },

  // Set by the order-retention system when an order reaches a terminal
  // status (Delivered or Cancelled). MongoDB's TTL index below will remove
  // the document once this date is reached. Orders with expiresAt = null
  // are never touched by the TTL scanner — this covers every active order
  // and every order created before this feature was added.
  expiresAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

// TTL index: MongoDB checks this field every ~60 s and removes documents
// whose expiresAt has passed. Documents where expiresAt is null or the
// field is absent are naturally ignored — no extra sparse configuration
// is needed because null is not a Date value the TTL scanner acts on.
// expireAfterSeconds: 0 means "delete as soon as expiresAt <= now".
orderSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Order', orderSchema);
