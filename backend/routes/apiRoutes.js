// backend/routes/apiRoutes.js
import express from "express";
import { createHash } from "node:crypto";
import EmailAccount from "../models/EmailAccount.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { runGmailSyncForUser } from "../workers/gmailSyncWorker.js";
import Email from "../models/Email.js";
import Thread from "../models/Thread.js";
import mongoose from "mongoose";
import { recordCategorizationFeedback } from "../classification/feedbackLearning.js";
import { CATEGORIZATION_RULES } from "../classification/categorizationRules.js";
import { redis } from "../utils/redis.js";
import {
  orchestrateDailyDigest,
  orchestrateSummaryIntent,
  orchestrateThreadSummary,
} from "../ai/orchestrator.js";
import {
  getOrchestratorStatus,
  recordOrchestratorStatus,
  clearOrchestratorStatus,
} from "../ai/orchestratorTelemetry.js";

const router = express.Router();

// Use real JWT-based authentication for all API routes
router.use(requireAuth);

// -----------------------------------------------------------
// GET /api/accounts → List all connected Gmail accounts for this user
// -----------------------------------------------------------
router.get("/accounts", async (req, res) => {
  try {
    const accounts = await EmailAccount.find({ userId: req.user.id }).select(
      "-refreshToken -accessToken"
    );
    res.json({ accounts });
  } catch (err) {
    console.error("Error fetching accounts:", err.message);
    res.status(500).json({ error: "Failed to load accounts" });
  }
});

// DELETE /api/accounts/:email → disconnect Gmail
router.delete("/accounts/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const userId = req.user.id;

    const account = await EmailAccount.findOneAndDelete({ userId, email });

    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    // *** CLEANUP EMAILS & THREADS FOR THIS ACCOUNT ***
    await Email.deleteMany({ accountId: account._id });
    await Thread.deleteMany({ accountId: account._id });

    console.log(`🗑️ Disconnected Gmail & cleaned emails: ${email}`);

    res.json({ message: "Account disconnected successfully", email });
  } catch (err) {
    console.error("Error disconnecting account:", err.message);
    res.status(500).json({ error: "Failed to disconnect Gmail account" });
  }
});


// DEBUG ONLY — run sync manually
router.get("/debug/run-sync", async (req, res) => {
  try {
    await runGmailSyncForUser(req.user.id);
    res.json({ message: "Sync completed successfully" });
  } catch (err) {
    console.error("Sync error:", err);
    res.status(500).json({ error: "Sync failed" });
  }
});

// ----------------------------
// DB-backed endpoints (Emails + Threads + time-window inboxes)
// ----------------------------


router.get("/db/thread/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Try direct Thread lookup
    let thread = await Thread.findOne({ threadId: id, userId }).lean();

    // If not found, maybe `id` is an Email _id instead of threadId
    if (!thread) {
      const maybeEmail = await Email.findOne({ _id: id, userId }).lean();
      if (maybeEmail?.threadId) {
        thread = await Thread.findOne({
          threadId: maybeEmail.threadId,
          userId,
        }).lean();
      }
    }

    // Helper to build consistent response format
    const buildResponse = (threadId, messages) => {
      const attachments = messages.flatMap((msg) =>
        (msg.attachments || []).map((a) => ({
          filename: a.filename,
          mimeType: a.mimeType,
          storageUrl: a.storageUrl,
          messageId: msg.messageId,
          emailId: msg._id,
        }))
      );

      return { threadId, attachments, messages };
    };

    // Case: Still no thread doc → fallback to Emails only
    if (!thread) {
      const messages = await Email.find({ threadId: id, userId })
        .sort({ date: 1 })
        .lean();

      if (messages.length > 0) {
        return res.json(buildResponse(id, messages));
      }

      return res.status(404).json({ error: "Thread not found" });
    }

    // Normal case: thread exists → load related emails
    const messages = await Email.find({
      threadId: thread.threadId,
      userId,
    })
      .sort({ date: 1 })
      .lean();

    return res.json(buildResponse(thread.threadId, messages));
  } catch (err) {
    console.error("DB thread fetch error:", err);
    return res.status(500).json({ error: "Failed to fetch thread from DB" });
  }
});

router.get('/inbox/today', async (req, res) => {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    // Today's Decisions filtering
    const decision = typeof req.query.decision === "string"
      ? req.query.decision.toUpperCase()
      : "";
    const dueOnlyToday = String(req.query.dueOnly || "").toLowerCase() === "true";
    const overdueOnlyToday = String(req.query.overdueOnly || "").toLowerCase() === "true";

    let baseFilter = {
      userId: req.user.id,
      date: { $gte: start, $lte: end },
    };
    let sortOrder = { date: -1 };

    // 🎯 Today’s Decisions filters
    if (decision === "NEEDS_REPLY") {
      baseFilter = {
        userId: req.user.id,
        needsReply: true,
        isIncoming: true,
        date: { $gte: start, $lte: end },
      };
    }

    if (decision === "DEADLINES_TODAY") {
      baseFilter = {
        userId: req.user.id,
        hasDeadline: true,
        date: { $gte: start, $lte: end },
      };
      if (dueOnlyToday) {
        baseFilter.deadlineAt = { $gte: start, $lte: end };
      }
      sortOrder = { date: -1, deadlineAt: 1 };
    }

    if (decision === "OVERDUE_FOLLOWUPS") {
      baseFilter = {
        userId: req.user.id,
        isFollowUp: true,
        date: { $gte: start, $lte: end },
      };
      if (overdueOnlyToday) {
        baseFilter.isOverdueFollowUp = true;
      }
      sortOrder = { isOverdueFollowUp: -1, followUpWaitingSince: 1, date: -1 };
    }

    const emails = await Email.find(baseFilter)
      .sort(sortOrder)
      .lean();

    const threadIds = [...new Set(emails.map(e => e.threadId).filter(Boolean))];
    const threads = await Thread.find(
      { userId: req.user.id, threadId: { $in: threadIds } },
      { threadId: 1, unreadCount: 1 }
    ).lean();

    const unreadMap = {};
    for (const t of threads) unreadMap[t.threadId] = t.unreadCount || 0;

    const enrichedEmails = emails.map(e => ({
      ...e,
      unreadCount: unreadMap[e.threadId] || 0,
    }));

    res.json({ emails: enrichedEmails });
  } catch (err) {
    console.error('Error loading today emails:', err);
    res.status(500).json({ error: 'Failed to load today\'s emails' });
  }
});

// GET /api/inbox/yesterday -> unified inbox for yesterday
router.get('/inbox/yesterday', async (req, res) => {
  try {
    const userId = req.user.id;
    const start = new Date();
    start.setDate(start.getDate() - 1);
    start.setHours(0,0,0,0);

    const end = new Date();
    end.setDate(end.getDate() - 1);
    end.setHours(23,59,59,999);

    const emails = await Email.find({
      userId,
      date: { $gte: start, $lte: end },
    }).sort({ date: -1 }).lean();

    const threadIds = [...new Set(emails.map(e => e.threadId).filter(Boolean))];
    const threads = await Thread.find(
      { userId: req.user.id, threadId: { $in: threadIds } },
      { threadId: 1, unreadCount: 1 }
    ).lean();

    const unreadMap = {};
    for (const t of threads) unreadMap[t.threadId] = t.unreadCount || 0;

    const enrichedEmails = emails.map(e => ({
      ...e,
      unreadCount: unreadMap[e.threadId] || 0,
    }));

    res.json({ emails: enrichedEmails });
  } catch (err) {
    console.error('Error loading yesterday inbox:', err);
    res.status(500).json({ error: "Failed to load yesterday's inbox" });
  }
});

// GET /api/inbox/week -> unified inbox for last 7 days (including today)
router.get('/inbox/week', async (req, res) => {
  try {
    const userId = req.user.id;
    const end = new Date();
    end.setHours(23,59,59,999);

    const start = new Date();
    start.setDate(start.getDate() - 6); // last 7 days including today
    start.setHours(0,0,0,0);

    const emails = await Email.find({
      userId,
      date: { $gte: start, $lte: end },
    }).sort({ date: -1 }).lean();

    const threadIds = [...new Set(emails.map(e => e.threadId).filter(Boolean))];
    const threads = await Thread.find(
      { userId: req.user.id, threadId: { $in: threadIds } },
      { threadId: 1, unreadCount: 1 }
    ).lean();

    const unreadMap = {};
    for (const t of threads) unreadMap[t.threadId] = t.unreadCount || 0;

    const enrichedEmails = emails.map(e => ({
      ...e,
      unreadCount: unreadMap[e.threadId] || 0,
    }));

    res.json({ emails: enrichedEmails });
  } catch (err) {
    console.error('Error loading week inbox:', err);
    res.status(500).json({ error: 'Failed to load week inbox' });
  }
});


router.get("/inbox/monthly", async (req, res) => {
  try {
    const userId = req.user.id;

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const start = new Date();
    start.setDate(start.getDate() - 29); // last 30 days including today
    start.setHours(0, 0, 0, 0);

    const emails = await Email.find({
      userId,
      date: { $gte: start, $lte: end },
    })
      .sort({ date: -1 })
      .lean();

    const threadIds = [...new Set(emails.map(e => e.threadId).filter(Boolean))];
    const threads = await Thread.find(
      { userId: req.user.id, threadId: { $in: threadIds } },
      { threadId: 1, unreadCount: 1 }
    ).lean();

    const unreadMap = {};
    for (const t of threads) unreadMap[t.threadId] = t.unreadCount || 0;

    const enrichedEmails = emails.map(e => ({
      ...e,
      unreadCount: unreadMap[e.threadId] || 0,
    }));

    res.json({ emails: enrichedEmails });
  } catch (err) {
    console.error("Error loading monthly inbox:", err);
    res.status(500).json({ error: "Failed to load monthly inbox" });
  }
});

router.post("/emails/:id/category-feedback", async (req, res) => {
  try {
    const { id } = req.params;
    const { category } = req.body || {};
    const userId = req.user.id;

    if (!category || !CATEGORIZATION_RULES.CATEGORY_LIST.includes(category)) {
      return res.status(400).json({ error: "Invalid category provided" });
    }

    const lookupOr = [
      { messageId: id },
      { threadId: id },
    ];

    if (mongoose.Types.ObjectId.isValid(id)) {
      lookupOr.unshift({ _id: id });
    }

    // Primary resolution by identifier (robust for legacy rows where userId/account links are inconsistent)
    let email = await Email.findOne({
      $or: lookupOr,
    }).sort({ date: -1 });

    // Fallback for legacy rows where Email.userId may be missing/misaligned:
    // resolve email first, then verify it belongs to one of the user's accounts.
    if (!email) {
      const fallbackEmail = await Email.findOne({
        $or: lookupOr,
      }).sort({ date: -1 });

      if (fallbackEmail?.accountId) {
        const ownedAccount = await EmailAccount.findOne({
          _id: fallbackEmail.accountId,
          userId,
        }).lean();

        if (ownedAccount) {
          email = fallbackEmail;
          if (!email.userId || String(email.userId) !== String(userId)) {
            email.userId = userId;
          }
        }
      }
    }

    if (!email) {
      return res.status(404).json({ error: `Email not found for id: ${id}` });
    }

    // Keep data aligned for future strict lookups.
    if (!email.userId || String(email.userId) !== String(userId)) {
      email.userId = userId;
    }

    await recordCategorizationFeedback({
      userId,
      email,
      correctedCategory: category,
    });

    email.category = category;
    email.categoryScore = 1;
    await email.save();

    return res.json({
      ok: true,
      message: "Feedback recorded and category updated",
      emailId: email._id,
      category,
    });
  } catch (err) {
    console.error("Category feedback error:", err);
    return res.status(500).json({ error: "Failed to record category feedback" });
  }
});

router.get("/ai/orchestrator-status", async (req, res) => {
  try {
    const limit = Number(req.query.limit || 12);
    const items = await getOrchestratorStatus({
      userId: req.user.id,
      limit,
    });
    return res.json({ items });
  } catch (err) {
    console.error("AI orchestrator status error:", err);
    return res.status(500).json({ error: "Failed to load orchestrator status" });
  }
});

router.delete("/ai/orchestrator-status", async (req, res) => {
  try {
    await clearOrchestratorStatus({ userId: req.user.id });
    return res.json({ ok: true });
  } catch (err) {
    console.error("AI orchestrator status clear error:", err);
    return res.status(500).json({ error: "Failed to clear orchestrator status" });
  }
});

/* ---------------------------------------------------------
   POST /api/ai/summarize-thread
   Summarizes a thread via AI Orchestrator
--------------------------------------------------------- */
router.post("/ai/summarize-thread", async (req, res) => {
  try {
    const { threadId } = req.body;

    if (!threadId) {
      return res.status(400).json({ error: "threadId is required" });
    }

    // Fetch thread
    const thread = await Thread.findOne({
      threadId,
      userId: req.user.id
    }).lean();

    if (!thread) {
      return res.status(404).json({ error: "Thread not found" });
    }

    // Fetch messages
    const messages = await Email.find({
      threadId,
      userId: req.user.id
    })
      .sort({ date: 1 })
      .lean();

    if (!messages || messages.length === 0) {
      return res.status(404).json({ error: "No messages found for this thread" });
    }

    const summary = await orchestrateThreadSummary({
      threadId,
      messages,
      redisClient: redis,
    });

    if (summary?._meta) {
      await recordOrchestratorStatus({
        userId: req.user.id,
        meta: summary._meta,
        context: { threadId },
      });
    }

    res.json(summary);

  } catch (err) {
    console.error("AI summary error:", err);
    res.status(500).json({ error: "Failed to summarize thread" });
  }
});


/* ---------------------------------------------------------
   POST /api/ai/classify
   Orchestrated summary intent classifier
--------------------------------------------------------- */
router.post("/ai/classify", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "message is required" });
    }

    const result = await orchestrateSummaryIntent({ message });
    if (result?._meta) {
      await recordOrchestratorStatus({
        userId: req.user.id,
        meta: result._meta,
      });
    }
    res.json(result);
  } catch (err) {
    console.error("Classifier error:", err);
    res.status(500).json({ error: "Classifier failed" });
  }
});

/* ---------------------------------------------------------
   POST /api/ai/daily-digest
   Generate AI Daily Digest for the last 24 hours
--------------------------------------------------------- */
/* ---------------------------------------------------------
   POST /api/ai/daily-digest
   Generate AI Daily Digest for the last 24 hours (smart)
   Extracts: bills, meetings, travel, action items, priorities, attachments
--------------------------------------------------------- */
router.post("/ai/daily-digest", async (req, res) => {
  try {
    const userId = req.user.id;

    // Time window: last 24 hours
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 1);

    // Fetch all emails from last 24 hours
    const emails = await Email.find({
      userId,
      date: { $gte: start, $lte: end },
    })
      .sort({ date: -1 })
      .lean();

    // Strict exclusion: remove newsletters, promotions, and true spam only (not socials/updates)
    const filteredEmails = emails.filter((e) => {
      const subject = e.subject || "";
      const body = (e.textBody || e.body || "").toLowerCase();

      const isNewsletter =
        /newsletter|digest|update|roundup|daily digest|medium|substack|beehiiv/i.test(
          subject
        ) || /newsletter|digest|update|roundup|daily digest|medium|substack|beehiiv/i.test(
          body
        );

      const isPromo =
        /unsubscribe|offer|sale|promo|deal|discount|save|shop now/i.test(subject) ||
        /unsubscribe|offer|sale|promo|deal|discount|save|shop now/i.test(body);

      // Social/Updates often contain valid emails — DO NOT auto-exclude them
      const isSocial = false;

      // Only exclude true spam & verified newsletters/promotions
      const isSpamLabel =
        Array.isArray(e.labelIds) &&
        e.labelIds.some((l) => l.toUpperCase() === "SPAM");

      // Final strict-mode exclusion:
      return !(isNewsletter || isPromo || isSpamLabel);
    });

    if (!emails || emails.length === 0) {
      return res.json({
        summary: "No emails received in the last 24 hours.",
      });
    }

    // Helper regexes & detectors
    const newsletterKeywords = /\b(newsletter|digest|update|roundup|daily digest|medium|substack|beehiiv)\b/i;
    const promoKeywords = /\b(unsubscribe|offer|sale|promo|deal|discount|save|shop now)\b/i;
    const moneyRegex = /(?:₹|\$|€|£)?\s?(\d{1,3}(?:[,.\s]\d{3})*(?:[.,]\d{1,2})?)/g;
    const billKeywords = /\b(invoice|bill|due date|amount due|payment|paid|receipt|statement|subscription|renewal)\b/i;
    const meetingKeywords = /\b(meeting|call|zoom|google meet|hangout|interview|appointment|agenda|schedule)\b/i;
    const travelKeywords = /\b(flight|itinerary|ticket|boarding|reservation|hotel|booking|PNR|train|bus)\b/i;
    const actionKeywords = /\b(please respond|please reply|action required|need your|please approve|your action|required by|kindly respond|follow up|follow-up)\b/i;
    const urgentKeywords = /\b(urgent|asap|immediately|important|priority|attention required)\b/i;

    // Basic extraction helpers
    function extractAmounts(text) {
      const amounts = [];
      let m;
      while ((m = moneyRegex.exec(text)) !== null) {
        amounts.push(m[0].trim());
      }
      return Array.from(new Set(amounts)).slice(0, 3);
    }

    function extractDates(text) {
      const patterns = [
        /\b\d{4}-\d{2}-\d{2}\b/g,              // 2025-11-28
        /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g,        // 12/10/2025
        /\b\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/gi, // 10 Dec
        /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\b/gi  // Dec 10
      ];
      const found = [];
      for (const p of patterns) {
        let m;
        while ((m = p.exec(text)) !== null) found.push(m[0]);
      }
      return Array.from(new Set(found)).slice(0, 3);
    }

    // Analyze each email for features
    const bills = [];
    const meetings = [];
    const travels = [];
    const actions = [];
    const priorityUnread = [];
    const attachmentsSummary = [];

    filteredEmails.forEach((e) => {
      const from = e.from || "Unknown";
      const subject = e.subject || "(no subject)";
      const body = (e.textBody || e.body || "").replace(/<[^>]*>?/gm, " ");
      const snippet = (body || "").slice(0, 1200);

      const isNewsletter = newsletterKeywords.test(subject) || newsletterKeywords.test(body);
      const isPromo = promoKeywords.test(subject) || promoKeywords.test(body);

      // Skip newsletters & promos from ALL structured sections
      if (isNewsletter || isPromo) {
        return; // Still included in summary & top senders automatically
      }

      // Attachments
      if (Array.isArray(e.attachments) && e.attachments.length > 0) {
        attachmentsSummary.push({
          emailId: e._id,
          subject,
          from,
          attachments: e.attachments.map((a) => ({
            filename: a.filename,
            mimeType: a.mimeType,
            storageUrl: a.storageUrl,
          })),
        });
      }

      // Bills detection
      if (billKeywords.test(subject) || billKeywords.test(body)) {
        bills.push({
          emailId: e._id,
          from,
          subject,
          amounts: extractAmounts(body).slice(0, 2),
          possibleDates: extractDates(body),
          snippet,
        });
      }

      // Meetings detection
      const hasRealDate = extractDates(body).length > 0;
      if (hasRealDate && (meetingKeywords.test(subject) || meetingKeywords.test(body) || (Array.isArray(e.labelIds) && e.labelIds.includes("CALENDAR")))) {
        meetings.push({
          emailId: e._id,
          from,
          subject,
          possibleDates: extractDates(body),
          snippet,
        });
      }

      // Travel detection
      if (travelKeywords.test(subject) || travelKeywords.test(body)) {
        travels.push({
          emailId: e._id,
          from,
          subject,
          snippet,
        });
      }

      // Action items detection
      if (extractDates(body).length > 0 && (actionKeywords.test(subject) || urgentKeywords.test(subject) || actionKeywords.test(body) || urgentKeywords.test(body))) {
        actions.push({
          emailId: e._id,
          from,
          subject,
          possibleDates: extractDates(body),
          snippet,
        });
      }

      // Priority / unread
      if ((e.unread === true || e.isUnread === true) &&
          extractDates(body).length > 0 &&
          (urgentKeywords.test(subject) || urgentKeywords.test(body))) {
        priorityUnread.push({
          emailId: e._id,
          from,
          subject,
          snippet,
        });
      }
    });

    // Build sender stats
    const senderCounts = {};
    filteredEmails.forEach((email) => {
      const from = email.from || "Unknown";
      senderCounts[from] = (senderCounts[from] || 0) + 1;
    });

    const topSenders = Object.entries(senderCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([sender, count]) => ({ sender, count }));

    // Build concise cleaned emails for AI prompt (limit tokens)
    const cleanedEmails = filteredEmails
      .slice(0, 40) // limit to first 40 emails to avoid huge prompts
      .map((e) => {
        const text = (e.textBody || e.body || "").replace(/<[^>]*>?/gm, "");
        return {
          id: e._id,
          from: e.from,
          subject: e.subject,
          snippet: text.slice(0, 800),
          date: e.date,
        };
      });

    // Structured payload for AI
    const payload = {
      meta: {
        timeframe: "last_24_hours",
        totalEmails: filteredEmails.length,
        topSenders,
        counts: {
          bills: bills.length,
          meetings: meetings.length,
          travels: travels.length,
          actions: actions.length,
          priorityUnread: priorityUnread.length,
          attachments: attachmentsSummary.length,
        },
      },
      examples: {
        bills: bills.slice(0, 6),
        meetings: meetings.slice(0, 6),
        travels: travels.slice(0, 6),
        actions: actions.slice(0, 8),
        priorityUnread: priorityUnread.slice(0, 6),
        attachments: attachmentsSummary.slice(0, 6),
      },
      emails: cleanedEmails,
    };

    const digestSignatureSource = cleanedEmails
      .map((e) => `${String(e.id || "")}:${new Date(e.date || 0).getTime()}`)
      .join("|");
    const digestFingerprint = createHash("sha1")
      .update(`${userId}|${filteredEmails.length}|${digestSignatureSource}`)
      .digest("hex")
      .slice(0, 16);
    const digestCacheKey = `ai:daily-digest:v3:${userId}:${digestFingerprint}`;

    const result = await orchestrateDailyDigest({
      payload,
      redisClient: redis,
      cacheKey: digestCacheKey,
    });
    if (result?._meta) {
      await recordOrchestratorStatus({
        userId: req.user.id,
        meta: result._meta,
      });
    }
    return res.json(result);
  } catch (err) {
    console.error("AI Daily Digest error:", err);
    res.status(500).json({ error: "Failed to generate daily digest" });
  }
});

export default router;
