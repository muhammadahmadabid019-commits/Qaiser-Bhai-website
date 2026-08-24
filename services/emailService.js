// Transactional email, kept separate from routes and from
// services/orderWorkflowService.js — same separation-of-concerns pattern
// as services/paymentService.js and services/inventoryService.js. This is
// the ONLY file that talks to the Resend SDK or knows the on-disk email
// template paths; every caller just asks for a named email to be sent.
//
// Every public function here resolves successfully no matter what happens
// internally (missing config, template error, Resend API error, network
// failure) — it never throws. That's deliberate: a customer's order must
// never fail to place, and an admin's approve/ship/deliver/cancel action
// must never fail to save, just because an email couldn't be sent. Errors
// are logged, not swallowed silently, so a misconfigured RESEND_API_KEY or
// a bad template is still visible in the server logs.

const path = require('path');
const ejs = require('ejs');
const { Resend } = require('resend');
const { formatPrice } = require('../utils/currency');

const TEMPLATES_DIR = path.join(__dirname, '../templates/emails');

// Constructed lazily (not at module load) so requiring this file never
// fails just because RESEND_API_KEY isn't set yet (e.g. running tests or
// scripts that don't send mail) — the check happens at send time instead.
let resendClient = null;
function getClient() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

function baseContext() {
  const appUrl = (process.env.APP_URL || '').replace(/\/+$/, '');
  return {
    companyName: process.env.COMPANY_NAME || 'Our Store',
    supportEmail: process.env.SUPPORT_EMAIL || '',
    supportPhone: process.env.SUPPORT_PHONE || '',
    appUrl,
    year: new Date().getFullYear()
  };
}

// Shared template data every order-related email needs. Order documents
// already carry a `name`/`price` snapshot on each line item (see
// models/Order.js), so no populate() is required here.
function orderContext(order) {
  const base = baseContext();
  const orderNumber = order._id.toString().slice(-8).toUpperCase();
  return {
    ...base,
    order,
    orderNumber,
    orderDate: new Date(order.createdAt).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' }),
    orderUrl: `${base.appUrl}/orders/${order._id}`,
    formatPrice
  };
}

// Renders a named content template, then wraps it in the shared branded
// layout. Two separate ejs.renderFile passes (not <%- include('layout') %>
// from inside each template) so every content template stays a plain
// fragment — simpler to write and to unit-test in isolation.
async function renderEmail(templateName, data) {
  const content = await ejs.renderFile(path.join(TEMPLATES_DIR, `${templateName}.ejs`), data);
  return ejs.renderFile(path.join(TEMPLATES_DIR, 'layout.ejs'), { ...data, content });
}

async function sendEmail({ to, subject, template, data }) {
  try {
    if (!to) {
      console.warn(`[emailService] Skipping "${subject}" — no recipient email on file.`);
      return { success: false, skipped: true };
    }
    const from = process.env.EMAIL_FROM;
    if (!from) {
      console.warn(`[emailService] EMAIL_FROM is not set — skipping "${subject}" to ${to}.`);
      return { success: false, skipped: true };
    }
    const client = getClient();
    if (!client) {
      console.warn(`[emailService] RESEND_API_KEY is not set — skipping "${subject}" to ${to}.`);
      return { success: false, skipped: true };
    }

    const html = await renderEmail(template, data);
    const result = await client.emails.send({ from, to, subject, html });

    if (result.error) {
      console.error(`[emailService] Resend rejected "${subject}" to ${to}:`, result.error);
      return { success: false, error: result.error };
    }

    console.log(`[emailService] Sent "${subject}" to ${to} (id: ${result.data && result.data.id})`);
    return { success: true, id: result.data && result.data.id };
  } catch (err) {
    // Catches template render errors, network errors, or anything else —
    // this function must never throw, per the "never block checkout/order
    // updates" requirement every caller relies on.
    console.error(`[emailService] Failed to send "${subject}" to ${to}:`, err);
    return { success: false, error: err.message };
  }
}

async function sendOrderConfirmation(order) {
  const data = orderContext(order);
  return sendEmail({
    to: order.email,
    subject: `Order Confirmation - #${data.orderNumber} - ${data.companyName}`,
    template: 'order-confirmation',
    data
  });
}

async function sendPaymentVerified(order) {
  const data = orderContext(order);
  return sendEmail({
    to: order.email,
    subject: `Payment Verified - Order #${data.orderNumber} - ${data.companyName}`,
    template: 'payment-verified',
    data
  });
}

async function sendPaymentRejected(order) {
  const data = orderContext(order);
  return sendEmail({
    to: order.email,
    subject: `Payment Verification Issue - Order #${data.orderNumber} - ${data.companyName}`,
    template: 'payment-rejected',
    data
  });
}

async function sendOrderShipped(order) {
  const data = orderContext(order);
  return sendEmail({
    to: order.email,
    subject: `Your Order #${data.orderNumber} Has Shipped - ${data.companyName}`,
    template: 'order-shipped',
    data
  });
}

async function sendOrderDelivered(order) {
  const data = orderContext(order);
  return sendEmail({
    to: order.email,
    subject: `Your Order #${data.orderNumber} Has Been Delivered - ${data.companyName}`,
    template: 'order-delivered',
    data
  });
}

async function sendOrderCancelled(order) {
  const data = orderContext(order);
  return sendEmail({
    to: order.email,
    subject: `Order #${data.orderNumber} Cancelled - ${data.companyName}`,
    template: 'order-cancelled',
    data
  });
}

module.exports = {
  sendOrderConfirmation,
  sendPaymentVerified,
  sendPaymentRejected,
  sendOrderShipped,
  sendOrderDelivered,
  sendOrderCancelled
};
