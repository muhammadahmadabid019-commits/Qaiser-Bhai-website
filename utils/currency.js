// Centralized currency configuration for the store.
// All price display anywhere in the app (views, admin panel, API
// responses) must go through formatPrice() rather than hardcoding a
// currency symbol — this is the single place that changes if the
// business ever needs to support a different currency or formatting.

const CURRENCY_SYMBOL = 'Rs.';
const CURRENCY_CODE = 'PKR';
const LOCALE = 'en-PK';

// Delivery fee tiers, in PKR. This is the single source of truth for
// shipping costs — cart, checkout, the order confirmation, and the REST
// API must all go through calcDeliveryFee() rather than hardcoding their
// own shipping number, or their displayed fees will drift apart.
const STANDARD_DELIVERY_FEE = 250;
const EXPRESS_DELIVERY_FEE = 450;
// FREE_DELIVERY_THRESHOLD removed — shipping is always charged.

function calcDeliveryFee(method) {
  return method === 'Express' ? EXPRESS_DELIVERY_FEE : STANDARD_DELIVERY_FEE;
}

function formatPrice(amount) {
  const value = Math.round(Number(amount) || 0);
  return `${CURRENCY_SYMBOL} ${value.toLocaleString(LOCALE)}`;
}

module.exports = {
  CURRENCY_SYMBOL,
  CURRENCY_CODE,
  LOCALE,
  STANDARD_DELIVERY_FEE,
  EXPRESS_DELIVERY_FEE,
  calcDeliveryFee,
  formatPrice
};
