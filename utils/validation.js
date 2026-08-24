// Shared validation patterns. EMAIL_FORMAT was previously duplicated
// identically in routes/checkout.js — centralized here so both that file
// and routes/index.js (quote requests) stay in sync automatically.

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Pakistani mobile numbers only. Accepts the local format (03XXXXXXXXX,
// 11 digits) and the international-prefix format (+923XXXXXXXXX). This is
// deliberately more permissive than routes/checkout.js's phone check
// (03\d{9} only) — checkout is for local delivery contact, quote requests
// are a general inquiry channel where a +92-prefixed number is common.
const PAKISTAN_MOBILE_FORMAT = /^(?:\+92|0)3\d{9}$/;

// Escapes regex metacharacters in user-supplied search terms before they're
// interpolated into a Mongo $regex query. Without this, a query like
// `?search=(a+)+$` gets passed straight to the regex engine and can trigger
// catastrophic backtracking (ReDoS) on every request.
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { EMAIL_FORMAT, PAKISTAN_MOBILE_FORMAT, escapeRegex };
