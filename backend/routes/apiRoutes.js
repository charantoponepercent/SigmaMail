// backend/routes/apiRoutes.js
import express from "express";
import EmailAccount from "../models/EmailAccount.js";
import { getAuthorizedClientForAccount } from "../utils/googleClient.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { runGmailSyncForUser } from "../workers/gmailSyncWorker.js";
import Email from "../models/Email.js";
import Thread from "../models/Thread.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Redis from "ioredis";

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


// GET /api/db/thread/:id -> thread by threadId or by DB _id (fallback)
// router.get('/db/thread/:id', async (req, res) => {
//   try {
//     const { id } = req.params;
//     // console.log("this is id:",id);
//     const userId = req.user.id;

//     // Try find thread by threadId first
//     let thread = await Thread.findOne({ threadId: id, userId }).lean();

//     // If not found, maybe caller passed a message DB id — find the email and use its threadId
//     if (!thread) {
//       const maybeEmail = await Email.findOne({ _id: id, userId }).lean();
//       if (maybeEmail && maybeEmail.threadId) {
//         thread = await Thread.findOne({ threadId: maybeEmail.threadId, userId }).lean();
//         // console.log("this is thread from mongodbid",thread);
//       }
//     }

//     // If still no thread, try to build a thread from emails that share the same threadId
//     if (!thread) {
//       // try to find emails that match the id as a threadId
//       const messages = await Email.find({ threadId: id, userId }).sort({ date: 1 }).lean();
//       if (messages.length > 0) {
//         return res.json({ threadId: id, messages });
//       }
//       return res.status(404).json({ error: 'Thread not found' });
//     }

//     // If we found a thread doc, populate messages
//     const messages = await Email.find({ threadId: thread.threadId, userId }).sort({ date: 1 }).lean();
//     // console.log("this is msgs : ",messages)

//     res.json({ threadId: thread.threadId, messages });
//   } catch (err) {
//     console.error('DB thread fetch error:', err);
//     res.status(500).json({ error: 'Failed to fetch thread from DB' });
//   }
// });

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
      labelIds: { $in: ['INBOX'] },
      date: { $gte: start, $lte: end },
    }).sort({ date: -1 }).lean();

    res.json({ emails });
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
      labelIds: { $in: ['INBOX'] },
      date: { $gte: start, $lte: end },
    }).sort({ date: -1 }).lean();

    res.json({ emails });
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
      labelIds: { $in: ["INBOX"] },
      date: { $gte: start, $lte: end },
    })
      .sort({ date: -1 })
      .lean();

    res.json({ emails });
  } catch (err) {
    console.error("Error loading monthly inbox:", err);
    res.status(500).json({ error: "Failed to load monthly inbox" });
  }
});

/* ---------------------------------------------------------
   POST /api/ai/summarize-thread
   Summarizes a thread using Gemini 2.0 Flash with caching
--------------------------------------------------------- */
const redis = new Redis(process.env.REDIS_URL);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

router.post("/ai/summarize-thread", async (req, res) => {
  try {
    const { threadId, messages } = req.body;

    if (!threadId || !messages) {
      return res.status(400).json({ error: "threadId and messages are required" });
    }

    const cacheKey = `thread_summary:${threadId}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      return res.json(JSON.parse(cached));
    }

    // Clean and trim messages to avoid oversized payloads
    const cleanedMessages = messages
      .map(m => {
        const raw = (m.textBody || m.body || "").replace(/<[^>]*>?/gm, "");
        const trimmed = raw.slice(0, 1500); // limit to 1500 chars per email
        return `From: ${m.from}\n${trimmed}`;
      })
      .join("\n\n---\n\n");

    const prompt = `
You are an email summarization engine. Summarize the following email thread.

Thread:
${cleanedMessages}

Return ONLY valid JSON (no markdown, no explanations, no backticks).

The JSON MUST follow this exact schema:

{
  "quick": [
    "First key bullet point here",
    "Second key bullet point here",
    "Third key bullet point here"
  ],
  "actions": [
    "Action item 1",
    "Action item 2"
  ],
  "people": [
    "Person Name 1",
    "Person Name 2"
  ]
}

Rules:
- "quick" must be an array of 3–6 bullets.
- Bullets must be plain text (no *, **, markdown).
- "actions" must be actionable items.
- "people" must list human names mentioned in thread.
- DO NOT wrap the JSON in code fences.
- DO NOT output anything except the JSON object.
`;

    const response = await model.generateContent(prompt);
    const text = response.response.text();

    // Clean Gemini output (remove ```json, ``` and whitespace)
    let cleanText = text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    let summary;
    try {
      summary = JSON.parse(cleanText);
    } catch (e) {
      console.error("❌ Failed to parse Gemini JSON:", cleanText);
      return res.status(500).json({ error: "Invalid AI JSON format", raw: cleanText });
    }

    // Cache for 24 hours
    await redis.set(cacheKey, JSON.stringify(summary), "EX", 86400);

    res.json(summary);
  } catch (err) {
    console.error("AI summary error:", err);
    res.status(500).json({ error: "Failed to summarize thread" });
  }
});

export default router;



