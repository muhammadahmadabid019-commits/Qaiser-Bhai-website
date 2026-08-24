// Inventory logic, kept separate from order-creation logic (routes/checkout.js,
// routes/api.js) and order-management logic (routes/admin/orders.js) — same
// separation-of-concerns pattern as services/paymentService.js.

const Product = require('../models/Product');

// Atomically decrements stock for a list of { productId, quantity, name }
// items. Uses a conditional update (only matches if stock >= quantity at
// the moment of the write) rather than a plain read-then-write, so two
// concurrent purchases of the last remaining unit can't both succeed —
// exactly the race condition a naive "check stock, then save" approach
// would miss. Pass a Mongoose session to make this part of a larger
// transaction (see routes/checkout.js / routes/api.js).
//
// Throws an Error with `.code = 'INSUFFICIENT_STOCK'` and a user-facing
// `.message` on the first item that doesn't have enough stock. The caller
// is expected to abort its transaction on this — no partial deduction is
// left behind, since MongoDB transactions roll back every write made
// inside them, not just the one that failed.
async function deductStockForItems(items, session) {
  for (const { productId, quantity, name } of items) {
    const updated = await Product.findOneAndUpdate(
      { _id: productId, stock: { $gte: quantity } },
      { $inc: { stock: -quantity } },
      { returnDocument: 'after', session }
    );

    if (!updated) {
      const current = await Product.findById(productId).session(session);
      const available = current ? current.stock : 0;
      const err = new Error(`Only ${available} item(s) of "${name}" are currently available in stock.`);
      err.code = 'INSUFFICIENT_STOCK';
      throw err;
    }
  }
}

// Restores stock for a list of { productId, quantity } items — used when
// an order is cancelled before it shipped. Pass a Mongoose session to make
// this part of a larger transaction.
async function restoreStockForItems(items, session) {
  for (const { productId, quantity } of items) {
    const updated = await Product.findByIdAndUpdate(
      productId,
      { $inc: { stock: quantity } },
      { session, returnDocument: 'after' }
    );
    // findByIdAndUpdate resolves to null (not an error) if nothing matched
    // — e.g. the product was deleted from the catalog after the order was
    // placed. Previously this failed silently with no signal at all; now
    // it's at least logged so a missing restoration is diagnosable instead
    // of invisible.
    if (!updated) {
      console.warn(`restoreStockForItems: no product found for id ${productId} — stock NOT restored for this item.`);
    }
  }
}

module.exports = { deductStockForItems, restoreStockForItems };
