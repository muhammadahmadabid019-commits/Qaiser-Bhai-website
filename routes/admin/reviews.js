const express = require('express');
const router = express.Router();
const Review = require('../../models/Review');

const VALID_STATUSES = Review.schema.path('status').enumValues;

// GET /admin/reviews - list all reviews, optionally filtered by status
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const filter = (status && VALID_STATUSES.includes(status)) ? { status } : {};

    const [reviews, counts] = await Promise.all([
      Review.find(filter).sort('-createdAt'),
      Promise.all(VALID_STATUSES.map(s => Review.countDocuments({ status: s })))
    ]);

    const statusCounts = {};
    VALID_STATUSES.forEach((s, i) => { statusCounts[s] = counts[i]; });

    res.render('admin/reviews/index', {
      title: 'Manage Reviews',
      reviews,
      statusCounts,
      statuses: VALID_STATUSES,
      activeFilter: (status && VALID_STATUSES.includes(status)) ? status : 'All'
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// POST /admin/reviews/:id/status - change a review to any status (Pending/
// Approved/Rejected), from any current status. Only admins can reach this
// route (isAdmin, applied where this router is mounted in server.js).
// Home Page visibility is enforced separately in routes/index.js, which
// only ever queries status: 'Approved' — this route doesn't need to know
// or care where a review is displayed, just persist the change.
router.post('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!VALID_STATUSES.includes(status)) {
      req.flash('error', 'Invalid review status.');
      return res.redirect('/admin/reviews');
    }

    const review = await Review.findById(req.params.id);
    if (!review) {
      req.flash('error', 'Review not found.');
      return res.redirect('/admin/reviews');
    }

    review.status = status;
    await review.save();

    req.flash('success', `Review status updated to "${status}".`);
    res.redirect('/admin/reviews');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to update review status.');
    res.redirect('/admin/reviews');
  }
});

module.exports = router;
