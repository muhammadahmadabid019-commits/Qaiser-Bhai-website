const crypto = require('crypto');

// Lightweight session-bound CSRF protection for the admin panel's plain
// HTML forms (no SPA/fetch layer here, so a simple synchronizer token is
// enough — no need for the full csurf package and its cookie-secret setup).

// Ensures every session has a token and exposes it to views as csrfToken,
// so admin forms can embed it in a hidden field.
function ensureToken(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
}

// Rejects state-changing requests whose token doesn't match the one tied
// to the current session. Accepts the token either as a hidden form field
// (regular <form> POSTs) or an X-CSRF-Token header (the quotes admin page's
// fetch()-based JSON actions, which have no form to carry a hidden field).
function verifyToken(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const submitted = (req.body && req.body._csrf) || req.get('X-CSRF-Token');
  if (!submitted || submitted !== req.session.csrfToken) {
    // The quotes page's fetch() calls expect a JSON response, not a
    // redirect — respond in kind so its .then(r => r.json()) doesn't choke
    // on an HTML page. A request carrying the header form of the token (or
    // a JSON body) only ever comes from that fetch layer, never a <form>.
    if (req.get('X-CSRF-Token') || (req.get('Content-Type') || '').includes('application/json')) {
      return res.status(403).json({ success: false, message: 'Your session expired. Please refresh the page and try again.' });
    }
    req.flash('error', 'Your session expired or the form was submitted twice. Please try again.');
    return res.redirect(req.get('Referer') || '/admin/dashboard');
  }
  next();
}

module.exports = { ensureToken, verifyToken };
