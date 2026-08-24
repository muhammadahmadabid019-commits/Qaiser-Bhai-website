const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required']
  },
  customerName: {
    type: String,
    required: [true, 'Customer name is required'],
    trim: true
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot be more than 5']
  },
  message: {
    type: String,
    required: [true, 'Review message is required'],
    trim: true
  },
  // Customers can never set this directly — routes/index.js always creates
  // reviews with the schema default (Pending); only routes/admin/reviews.js
  // (isAdmin-protected) can move a review to Approved or Rejected.
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending'
  }
}, { timestamps: true });

module.exports = mongoose.model('Review', ReviewSchema);
