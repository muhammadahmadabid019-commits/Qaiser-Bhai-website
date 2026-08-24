// Single source of truth for stock status. Previously the number 5 was
// hardcoded independently in three places (admin product list, product
// detail page, admin dashboard's low-stock query) with no shared
// definition — the same "duplicated value can drift" problem fixed for
// shipping fees (utils/currency.js) and city names (data/pakistanCities.js)
// in earlier phases.
//
// Status is deliberately NOT stored on the Product document — it's always
// computed from the live `stock` count, so it can never drift out of sync
// with the actual number (a stored status field could go stale if stock
// changed through a path that forgot to also update it).

const LOW_STOCK_THRESHOLD = 5;

function getStockStatus(stock) {
  if (stock <= 0) return 'Out of Stock';
  if (stock <= LOW_STOCK_THRESHOLD) return 'Low Stock';
  return 'In Stock';
}

module.exports = { LOW_STOCK_THRESHOLD, getStockStatus };
