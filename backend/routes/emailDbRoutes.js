// backend/routes/emailDbRoutes.js
// Fetch inbox and today's emails from MongoDB (no Gmail API)

import express from 'express';
import Email from '../models/Email.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();
router.use(requireAuth);

// --------------------------------------------------------------
// GET /api/emails → Unified inbox (all accounts, sorted by date desc)
// --------------------------------------------------------------
router.get('/emails', async (req, res) => {
  try {
    const emails = await Email.find({
      userId: req.user.id,
      labelIds: { $in: ['INBOX'] },
    })
      .sort({ date: -1 })
      .limit(100);

    res.json({ emails });
  } catch (err) {
    console.error('Error loading inbox from DB:', err);
    res.status(500).json({ error: 'Failed to load inbox' });
  }
});

// --------------------------------------------------------------
// GET /api/emails/today → Only today's inbox mails
// --------------------------------------------------------------
router.get('/emails/today', async (req, res) => {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const emails = await Email.find({
      userId: req.user.id,
      labelIds: { $in: ['INBOX'] },
      date: { $gte: start, $lte: end },
    }).sort({ date: -1 });

    res.json({ emails });
  } catch (err) {
    console.error('Error loading today emails:', err);
    res.status(500).json({ error: 'Failed to load today\'s emails' });
  }
});

export default router;