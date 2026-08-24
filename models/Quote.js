const mongoose = require('mongoose');

const QuoteSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true
  },
  service: {
    type: String,
    required: [true, 'Service type is required'],
    trim: true
  },
  message: {
    type: String,
    trim: true
  },

  // Not enforced as "required" at the schema level, matching the existing
  // pattern in models/Order.js / routes/checkout.js — the stricter
  // required + length rules live in routes/index.js's route-level
  // validation, not the schema, so this stays permissive for any other
  // future caller.
  status: {
    type: String,
    enum: ['New', 'In Progress', 'Closed'],
    default: 'New'
  }
}, { timestamps: true });

module.exports = mongoose.model('Quote', QuoteSchema);
