/**
 * create-admin.js — one-time bootstrap for a brand-new, empty database.
 *
 * Usage: node create-admin.js
 *
 * Reads ADMIN_EMAIL / ADMIN_PASSWORD (and optionally ADMIN_NAME) from the
 * environment — never hardcoded — and creates exactly one initial admin,
 * but ONLY if the database currently has zero admins. If any admin already
 * exists (the normal case for this project), the script does nothing and
 * exits cleanly: ongoing admin management is done through the app itself,
 * at /admin/users (promote/revoke by email), not by rerunning this script.
 *
 * Safe to commit and safe to rerun — it never overwrites an existing
 * admin's password and never creates a second admin once one exists.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function main() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error('FATAL: MONGO_URI is not set. Copy .env.example to .env and fill in real values.');
    process.exit(1);
  }

  const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin';

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB.');

  try {
    const existingAdminCount = await User.countDocuments({ role: 'admin' });

    if (existingAdminCount > 0) {
      console.log(`No action taken: ${existingAdminCount} admin account(s) already exist. Use /admin/users in the app to manage admins.`);
      return;
    }

    // Only reached on a genuinely empty (zero-admin) database.
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      console.error('No admin exists yet, but ADMIN_EMAIL / ADMIN_PASSWORD are not set — cannot bootstrap the first admin.');
      console.error('Set both in your environment and rerun: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=... node create-admin.js');
      process.exitCode = 1;
      return;
    }

    if (ADMIN_PASSWORD.length < 6) {
      console.error('ADMIN_PASSWORD must be at least 6 characters (matches the User model\'s minlength).');
      process.exitCode = 1;
      return;
    }

    const email = ADMIN_EMAIL.trim().toLowerCase();
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      // A non-admin account with this email already exists (e.g. someone
      // registered before the first admin was bootstrapped) — promote it
      // rather than failing on the unique-email constraint.
      existingUser.role = 'admin';
      await existingUser.save();
      console.log(`Promoted existing user to admin: ${email}`);
    } else {
      // password is hashed by the User model's pre-save hook — never
      // stored or logged in plaintext.
      await User.create({ name: ADMIN_NAME, email, password: ADMIN_PASSWORD, role: 'admin' });
      console.log(`Initial admin created: ${email}`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
