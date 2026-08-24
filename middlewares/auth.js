const User = require('../models/User');

// Middleware: Ensure user is logged in
const isLoggedIn = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next();
  }
  req.flash('error', 'Please log in to access that page.');
  res.redirect('/auth/login');
};

// Middleware: Ensure user is an Admin. Re-checks the role from the
// database on every request rather than trusting req.session.userRole (a
// value cached at login time) — otherwise an admin whose access was just
// revoked would keep working until they happened to log out, since
// nothing else re-validates an already-open session. Also syncs the
// session's cached role to whatever the database says, so a subsequent
// promotion/demotion is reflected immediately without forcing a re-login,
// and so res.locals.currentUser (built from the session in server.js)
// never shows a stale role either.
const isAdmin = async (req, res, next) => {
  try {
    if (!req.session || !req.session.userId) {
      req.flash('error', 'Access Denied. Admins only.');
      return res.redirect('/');
    }

    const user = await User.findById(req.session.userId).select('role');
    const role = user && user.role ? user.role.trim().toLowerCase() : null;

    if (role === 'admin') {
      req.session.userRole = user.role;
      return next();
    }

    // Keep the session's cached role in sync even on denial, so a
    // demoted admin's next page load (any page, not just admin ones)
    // reflects their real role instead of the stale cached one.
    if (user) {
      req.session.userRole = user.role;
    }

    req.flash('error', 'Access Denied. Admins only.');
    res.redirect('/');
  } catch (err) {
    // Fail closed: a DB error here must deny access, never grant it.
    console.error('isAdmin: role verification failed:', err);
    req.flash('error', 'Could not verify admin access. Please try again.');
    res.redirect('/');
  }
};

module.exports = { isLoggedIn, isAdmin };
