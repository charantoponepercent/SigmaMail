// backend/routes/apiRoutes.js
import express from "express";
import { google } from "googleapis";
import User from "../models/User.js";
import EmailAccount from "../models/EmailAccount.js";
import { getAuthorizedClientForAccount } from "../utils/googleClient.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { runGmailSyncForUser } from "../workers/gmailSyncWorker.js";
import { parsePayloadDeep, fixBase64, fetchAttachmentData } from "../utils/emailParser.js";
import Email from "../models/Email.js";
import Thread from "../models/Thread.js";

const router = express.Router();

// ✅ Use real JWT-based authentication for all API routes
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

// -----------------------------------------------------------
// GET /api/gmail/messages?account=<email>&max=20
// -----------------------------------------------------------
// router.get("/gmail/messages", async (req, res) => {
//   try {
//     const accountEmail = req.query.account;
//     const label = req.query.label || "INBOX";

//     if (!accountEmail)
//       return res.status(400).json({ error: "account query param required" });

//     const authClient = await getAuthorizedClientForAccount(
//       accountEmail,
//       req.user.id
//     );
//     const gmail = google.gmail({ version: "v1", auth: authClient });

//     const maxResults = parseInt(req.query.max || "30", 10);
//     const listResp = await gmail.users.messages.list({
//       userId: "me",
//       labelIds: [label],
//       maxResults,
//     });

//     const msgs = listResp.data.messages || [];

//     const detailed = await Promise.all(
//       msgs.map(async (m) => {
//         const msg = await gmail.users.messages.get({
//           userId: "me",
//           id: m.id,
//           format: "metadata",
//           metadataHeaders: ["Subject", "From", "Date", "Thread-Id"],
//         });

//         const headers = msg.data.payload?.headers || [];
//         const subject =
//           headers.find((h) => h.name === "Subject")?.value || "(No Subject)";
//         const from =
//           headers.find((h) => h.name === "From")?.value || "Unknown";
//         const date = headers.find((h) => h.name === "Date")?.value || "";

//         return {
//           id: m.id,
//           threadId: msg.data.threadId,
//           subject,
//           from,
//           date,
//           account: accountEmail,
//         };
//       })
//     );

//     res.json({ messages: detailed });
//   } catch (err) {
//     console.error("Error fetching messages:", err.message);
//     res.status(500).json({ error: "Failed to fetch Gmail messages" });
//   }
// });

router.get("/gmail/messages", async (req, res) => {
  try {
    const accountEmail = req.query.account;
    const max = Number(req.query.max) || 30;
    const label = req.query.label || "INBOX";
    const pageToken = req.query.pageToken || undefined;

    if (!accountEmail)
      return res.status(400).json({ error: "account query param required" });

    const authClient = await getAuthorizedClientForAccount(
      accountEmail,
      req.user.id
    );
    const gmail = google.gmail({ version: "v1", auth: authClient });

    // Step 1: Get message metadata (IDs)
    const listResp = await gmail.users.messages.list({
      userId: "me",
      maxResults: max,
      labelIds: [label],
      pageToken,
    });

    const ids = listResp.data.messages || [];

    // Step 2: Fetch full message headers for preview
    const messages = [];
    for (const item of ids) {
      const msg = await gmail.users.messages.get({
        userId: "me",
        id: item.id,
        format: "metadata",
        metadataHeaders: ["Subject", "From", "Date", "Thread-Id"],
      });

      const headers = msg.data.payload.headers;

      const find = (name) =>
        headers.find((h) => h.name === name)?.value || "";

      messages.push({
        id: msg.data.id,
        threadId: msg.data.threadId,
        subject: find("Subject"),
        from: find("From"),
        date: find("Date"),
      });
    }

    res.json({
      messages,
      nextPageToken: listResp.data.nextPageToken || null,
    });
  } catch (err) {
    console.error("Error during pagination fetch:", err);
    res.status(500).json({ error: err.message });
  }
});

// router.get("/gmail/labels", async (req, res) => {
//   try {
//     const account = req.query.account;
//     if (!account) return res.status(400).json({ error: "Missing account" });

//     const auth = await getAuthorizedClientForAccount(account, req.user.id);
//     const gmail = google.gmail({ version: "v1", auth });

//     const LABEL_MAP = {
//       INBOX: "INBOX",
//       UNREAD: "UNREAD",
//       SENT: "SENT",
//       TRASH: "TRASH",
//       ARCHIVE: "ALL",
//     };

//     const results = {};

//     for (const [key, gmailLabel] of Object.entries(LABEL_MAP)) {
//       // total messages
//       const totalRes = await gmail.users.messages.list({
//         userId: "me",
//         labelIds: gmailLabel === "ALL" ? undefined : [gmailLabel],
//         includeSpamTrash: true,
//         maxResults: 1,
//       });

//       const total = totalRes.data.resultSizeEstimate || 0;

//       // unread messages
//       const unreadRes = await gmail.users.messages.list({
//         userId: "me",
//         labelIds:
//           gmailLabel === "ALL"
//             ? ["UNREAD"]
//             : [gmailLabel, "UNREAD"],
//         includeSpamTrash: true,
//         maxResults: 1,
//       });

//       const unread = unreadRes.data.resultSizeEstimate || 0;

//       results[key] = { total, unread };
//     }

//     res.json(results);
//   } catch (err) {
//     console.error("Label API Error:", err);
//     res.status(500).json({ error: "Failed to load counts" });
//   }
// });



// DELETE /api/accounts/:email → disconnect Gmail
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




/**
 * Route: GET /api/gmail/messages/:id
 * Returns a single message object. It contains:
 *  - id
 *  - threadId
 *  - subject, from, to, date
 *  - body (HTML with embedded inline images and appended attachments)
 *
 * This route will:
 *  - fetch the message
 *  - parse deep body + inline images + attachments
 *  - embed inline images (cid) and append attachments at bottom as <img>
 */

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

router.get("/gmail/messages/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const accountEmail = req.query.account;
    if (!accountEmail) return res.status(400).json({ error: "account query param required" });

    const authClient = await getAuthorizedClientForAccount(accountEmail, req.user.id);
    const gmail = google.gmail({ version: "v1", auth: authClient });

    // fetch message (full)
    const msgResp = await gmail.users.messages.get({ userId: "me", id, format: "full" });
    const payload = msgResp.data.payload || {};

    const { htmlBody, textBody, inlineParts, attachmentParts } = parsePayloadDeep(payload);

    // 1) Replace inline parts (cid:)
    let finalHtml = htmlBody || "";

    for (const inline of inlineParts) {
      let base64Data = inline.data ? fixBase64(inline.data) : null;

      if (!base64Data && inline.attachmentId) {
        try {
          base64Data = await fetchAttachmentData(gmail, id, inline.attachmentId);
        } catch (e) {
          console.warn("failed to fetch inline attachment", e.message);
        }
      }

      if (base64Data) {
        const dataUrl = `data:${inline.mimeType};base64,${base64Data}`;
        if (finalHtml) finalHtml = finalHtml.replace(new RegExp(`cid:${inline.cid}`, "g"), dataUrl);
      }
    }

    // 2) Append attachment images (real attachments) to HTML bottom
    for (const att of attachmentParts) {
      try {
        const base64 = await fetchAttachmentData(gmail, id, att.attachmentId);
        if (base64) {
          finalHtml += `<div style="margin-top:12px;"><img src="data:${att.mimeType};base64,${base64}" style="max-width:100%;border-radius:8px" /></div>`;
        }
      } catch (e) {
        console.warn("failed to fetch attachment", e.message);
      }
    }

    // fallback if no HTML
    const body = finalHtml || (textBody ? `<pre>${textBody}</pre>` : "(No content)");

    // headers
    const headers = payload.headers || [];
    const findHeader = (name) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

    const messageOut = {
      id,
      threadId: msgResp.data.threadId,
      subject: findHeader("Subject") || "(No Subject)",
      from: findHeader("From") || "Unknown",
      to: findHeader("To") || "",
      replyTo: findHeader("Reply-To") || "",
      date: findHeader("Date") || "",
      body,
      account: accountEmail,
    };

    res.json(messageOut);
  } catch (err) {
    console.error("Error in /gmail/messages/:id", err);
    res.status(500).json({ error: err.message || "Failed to fetch message" });
  }
});

/**
 * Route: GET /api/gmail/thread/:id
 * Accepts either a THREAD ID or a MESSAGE ID. If the given id is a message id,
 * it will fetch the message first and extract the true thread id.
 *
 * Returns: { threadId, messages: [ { id, threadId, subject, from, to, date, body } ] }
 *
 * Each message.body is processed the same way as /messages/:id: HTML extraction + inline images + attachments.
 */
router.get("/gmail/thread/:id", async (req, res) => {
  try {
    const { id: incomingId } = req.params;
    const accountEmail = req.query.account;
    if (!accountEmail) return res.status(400).json({ error: "account query param required" });

    const authClient = await getAuthorizedClientForAccount(accountEmail, req.user.id);
    const gmail = google.gmail({ version: "v1", auth: authClient });

    // Helper: ensure we have a thread id.
    let threadId = incomingId;

    // If incomingId might be a message id, try retrieving message to get threadId
    try {
      // try threads.get first (fastest path)
      await gmail.users.threads.get({ userId: "me", id: threadId });
    } catch (e) {
      // Not a valid threadId; try fetch as message to get threadId
      try {
        const msgResp = await gmail.users.messages.get({ userId: "me", id: incomingId, format: "full" });
        if (msgResp.data.threadId) threadId = msgResp.data.threadId;
        else {
          return res.status(400).json({ error: "Unable to resolve thread id from provided id" });
        }
      } catch (me) {
        return res.status(400).json({ error: "Invalid thread/message id" });
      }
    }

    // now fetch the thread
    const threadResp = await gmail.users.threads.get({ userId: "me", id: threadId });
    const finalMessages = [];

    for (const msg of threadResp.data.messages || []) {
      const payload = msg.payload || {};
      const { htmlBody, textBody, inlineParts, attachmentParts } = parsePayloadDeep(payload);

      // build finalHtml for this message
      let finalHtml = htmlBody || "";

      // replace inline parts
      for (const inline of inlineParts) {
        let base64Data = inline.data ? fixBase64(inline.data) : null;
        if (!base64Data && inline.attachmentId) {
          try {
            base64Data = await fetchAttachmentData(gmail, msg.id, inline.attachmentId);
          } catch (e) {
            console.warn("failed to fetch inline attachment in thread", e.message);
          }
        }
        if (base64Data) {
          const dataUrl = `data:${inline.mimeType};base64,${base64Data}`;
          if (finalHtml) finalHtml = finalHtml.replace(new RegExp(`cid:${inline.cid}`, "g"), dataUrl);
        }
      }

      // append attachments
      for (const att of attachmentParts) {
        try {
          const base64 = await fetchAttachmentData(gmail, msg.id, att.attachmentId);
          if (base64) {
            finalHtml += `<div style="margin-top:12px;"><img src="data:${att.mimeType};base64,${base64}" style="max-width:100%;border-radius:8px" /></div>`;
          }
        } catch (e) {
          console.warn("failed to fetch thread attachment", e.message);
        }
      }

      const body = finalHtml || (textBody ? `<pre>${textBody}</pre>` : "(no content)");

      // headers
      const headers = payload.headers || [];
      const findHeader = (name) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

      finalMessages.push({
        id: msg.id,
        threadId: msg.threadId,
        subject: findHeader("Subject") || "(No Subject)",
        from: findHeader("From") || "Unknown",
        to: findHeader("To") || "",
        date: findHeader("Date") || "",
        body,
      });
    }

    res.json({ threadId, messages: finalMessages });
  } catch (err) {
    console.error("Error in /gmail/thread/:id", err);
    res.status(500).json({ error: err.message || "Failed to fetch thread" });
  }
});




// ----------------------------
// DB-backed endpoints (Emails + Threads + time-window inboxes)
// ----------------------------


// GET /api/db/emails/:id  -> single email from DB
router.get('/db/emails/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const email = await Email.findOne({ _id: id, userId }).lean();
    if (!email) return res.status(404).json({ error: 'Email not found' });

    res.json(email);
  } catch (err) {
    console.error('DB email fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch email from DB' });
  }
});

// GET /api/db/thread/:id -> thread by threadId or by DB _id (fallback)
router.get('/db/thread/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Try find thread by threadId first
    let thread = await Thread.findOne({ threadId: id, userId }).lean();

    // If not found, maybe caller passed a message DB id — find the email and use its threadId
    if (!thread) {
      const maybeEmail = await Email.findOne({ _id: id, userId }).lean();
      if (maybeEmail && maybeEmail.threadId) {
        thread = await Thread.findOne({ threadId: maybeEmail.threadId, userId }).lean();
      }
    }

    // If still no thread, try to build a thread from emails that share the same threadId
    if (!thread) {
      // try to find emails that match the id as a threadId
      const messages = await Email.find({ threadId: id, userId }).sort({ date: 1 }).lean();
      if (messages.length > 0) {
        return res.json({ threadId: id, messages });
      }
      return res.status(404).json({ error: 'Thread not found' });
    }

    // If we found a thread doc, populate messages
    const messages = await Email.find({ threadId: thread.threadId, userId }).sort({ date: 1 }).lean();

    res.json({ threadId: thread.threadId, messages });
  } catch (err) {
    console.error('DB thread fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch thread from DB' });
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

export default router;



