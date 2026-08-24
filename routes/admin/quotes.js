const express = require('express');
const router = express.Router();
const Quote = require('../../models/Quote');

// Read directly from the schema instead of hardcoding a duplicate list —
// same pattern as routes/admin/orders.js and routes/admin/reviews.js.
const QUOTE_STATUSES = Quote.schema.path('status').enumValues;

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Shared filter-builder for both the page's embedded dataset and CSV
// export, so the two can never drift apart in what counts as "matching
// the active filters".
function buildQuoteQuery({ status, search }) {
  const query = {};
  if (status && QUOTE_STATUSES.includes(status)) {
    query.status = status;
  }
  if (search && search.trim()) {
    const re = new RegExp(escapeRegex(search.trim()), 'i');
    query.$or = [{ name: re }, { phone: re }, { email: re }];
  }
  return query;
}

function csvEscape(value) {
  const str = String(value === null || value === undefined ? '' : value);
  if (/[",\n]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// GET /admin/quotes - page shell. All quotes are embedded as JSON for the
// client-side table (search/filter/sort/bulk-select all happen in the
// browser over this data — appropriate at this scale, avoids a
// round-trip per interaction). ?status=New (etc.) pre-applies a filter,
// used by the dashboard's clickable status cards.
router.get('/', async (req, res) => {
  try {
    const quotes = await Quote.find().sort('-createdAt');
    const { status } = req.query;

    const counts = { New: 0, 'In Progress': 0, Closed: 0 };
    quotes.forEach(q => { if (counts[q.status] !== undefined) counts[q.status]++; });

    res.render('admin/quotes/index', {
      title: 'Quote Requests',
      quotes,
      quoteStatuses: QUOTE_STATUSES,
      counts,
      initialStatusFilter: (status && QUOTE_STATUSES.includes(status)) ? status : ''
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not load quote requests.');
    res.redirect('/admin/dashboard');
  }
});

// GET /admin/quotes/export - CSV download, respects the same filters the
// client-side table is currently showing (passed as query params).
router.get('/export', async (req, res) => {
  try {
    const query = buildQuoteQuery({ status: req.query.status, search: req.query.search });
    const sortOrder = req.query.sort === 'oldest' ? 'createdAt' : '-createdAt';
    const quotes = await Quote.find(query).sort(sortOrder);

    const header = ['Customer Name', 'Email', 'Phone Number', 'Requested Service', 'Message', 'Date', 'Status'];
    const rows = quotes.map(q => [
      q.name, q.email, q.phone, q.service, q.message || '',
      q.createdAt.toISOString(), q.status
    ]);
    const csv = [header, ...rows].map(row => row.map(csvEscape).join(',')).join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="quote-requests-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to export quote requests.');
    res.redirect('/admin/quotes');
  }
});

// POST /admin/quotes/bulk/status - update status for multiple quotes at
// once. Declared before /:id/status so Express doesn't mistake "bulk" for
// an :id value.
router.post('/bulk/status', async (req, res) => {
  try {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'No quote requests selected.' });
    }
    if (!QUOTE_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    const result = await Quote.updateMany({ _id: { $in: ids } }, { $set: { status } });

    res.json({
      success: true,
      message: `${result.modifiedCount} quote request${result.modifiedCount === 1 ? '' : 's'} updated successfully.`,
      modifiedCount: result.modifiedCount,
      status
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update selected quote requests.' });
  }
});

// POST /admin/quotes/bulk/delete - delete multiple quotes at once.
router.post('/bulk/delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'No quote requests selected.' });
    }

    const result = await Quote.deleteMany({ _id: { $in: ids } });

    res.json({
      success: true,
      message: `${result.deletedCount} quote request${result.deletedCount === 1 ? '' : 's'} deleted successfully.`,
      deletedCount: result.deletedCount
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to delete selected quote requests.' });
  }
});

// POST /admin/quotes/delete/:id - delete a single quote request (JSON,
// same URL shape as the original page-reload version this replaces).
router.post('/delete/:id', async (req, res) => {
  try {
    const quote = await Quote.findByIdAndDelete(req.params.id);
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote request not found.' });
    }
    res.json({ success: true, message: 'Quote deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to delete quote request.' });
  }
});

// POST /admin/quotes/:id/status - update a single quote's status.
router.post('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!QUOTE_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    const quote = await Quote.findByIdAndUpdate(req.params.id, { status }, { returnDocument: 'after' });
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote request not found.' });
    }

    res.json({ success: true, message: 'Quote status updated successfully.', quote });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update quote status.' });
  }
});

module.exports = router;
