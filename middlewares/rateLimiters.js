const rateLimit = require('express-rate-limit');

// Shared brute-force guard for login endpoints (web session login and the
// JWT API login) — previously unthrottled.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts. Please try again in a few minutes.'
});

module.exports = { loginLimiter };
