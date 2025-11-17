// backend/routes/apiRoutes.js
import express from "express";
import { google } from "googleapis";
import User from "../models/User.js";
import EmailAccount from "../models/EmailAccount.js";
import { getAuthorizedClientForAccount } from "../utils/googleClient.js";
import { requireAuth } from "../middleware/requireAuth.js";

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
router.delete("/accounts/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const userId = req.user.id;

    const account = await EmailAccount.findOneAndDelete({ userId, email });
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    console.log(`🗑️ Disconnected Gmail: ${email} for user ${userId}`);
    res.json({ message: "Account disconnected successfully", email });
  } catch (err) {
    console.error("Error disconnecting account:", err.message);
    res.status(500).json({ error: "Failed to disconnect Gmail account" });
  }
});



// helper: convert Gmail URL-safe base64 into standard base64
function fixBase64(str = "") {
  let fixed = str.replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, "");
  while (fixed.length % 4 !== 0) fixed += "=";
  return fixed;
}

// deep recursive body extractor: returns { htmlBody, textBody, inlineParts, attachmentParts }
// inlineParts: [{ cid, mimeType, data }] (data may be present on part.body.data)
// attachmentParts: [{ attachmentId, mimeType, filename }]
function parsePayloadDeep(payload) {
  let htmlBody = "";
  let textBody = "";
  const inlineParts = []; // inline images with body.data or attachmentId + cid
  const attachmentParts = []; // attachments with attachmentId

  function walk(part) {
    if (!part) return;

    // HTML (priority)
    if (part.mimeType === "text/html" && part.body?.data) {
      htmlBody = Buffer.from(fixBase64(part.body.data), "base64").toString("utf8");
    }

    // plain as fallback
    if (!htmlBody && part.mimeType === "text/plain" && part.body?.data) {
      textBody = Buffer.from(fixBase64(part.body.data), "base64").toString("utf8");
    }

    // inline image part: has Content-ID OR body.data on image part
    const cidHeader = part.headers?.find((h) => h.name === "Content-ID");
    if (cidHeader && part.mimeType?.startsWith("image/")) {
      inlineParts.push({
        cid: cidHeader.value.replace(/[<>]/g, ""),
        mimeType: part.mimeType,
        data: part.body?.data ?? null,
        attachmentId: part.body?.attachmentId ?? null,
        filename: part.filename || null,
      });
    }

    // image attachment (real attachmentId)
    if (part.body?.attachmentId && part.mimeType?.startsWith("image/")) {
      attachmentParts.push({
        attachmentId: part.body.attachmentId,
        mimeType: part.mimeType,
        filename: part.filename || null,
        cid: cidHeader?.value ? cidHeader.value.replace(/[<>]/g, "") : null,
      });
    }

    if (part.parts) {
      for (const p of part.parts) walk(p);
    }
  }

  walk(payload);
  return { htmlBody, textBody, inlineParts, attachmentParts };
}

// helper: fetch an attachment (base64 string) given messageId + attachmentId
async function fetchAttachmentData(gmailClient, messageId, attachmentId) {
  const att = await gmailClient.users.messages.attachments.get({
    userId: "me",
    messageId,
    id: attachmentId,
  });
  return att.data?.data ? fixBase64(att.data.data) : null; // return standard base64 string
}

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



export default router;



