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
router.get("/gmail/messages", async (req, res) => {
  try {
    const accountEmail = req.query.account;
    if (!accountEmail)
      return res.status(400).json({ error: "account query param required" });

    // ✅ Get authorized Gmail API client
    const authClient = await getAuthorizedClientForAccount(
      accountEmail,
      req.user.id
    );
    const gmail = google.gmail({ version: "v1", auth: authClient });

    // ✅ List basic messages (lightweight)
    const maxResults = parseInt(req.query.max || "20", 10);
    const listResp = await gmail.users.messages.list({
      userId: "me",
      maxResults,
    });

    const msgs = listResp.data.messages || [];
    if (msgs.length === 0) {
      return res.json({ messages: [] });
    }

    // ✅ Fetch extended headers for each message
    const detailed = await Promise.all(
      msgs.map(async (m) => {
        try {
          const msg = await gmail.users.messages.get({
            userId: "me",
            id: m.id,
            format: "metadata",
            metadataHeaders: [
              "Subject",
              "From",
              "To",
              "Reply-To",
              "Date",
              "Mailed-By",
              "Signed-By",
              "X-Mailer",
            ],
          });

          const headers = msg.data.payload?.headers || [];

          // Helper to find header value easily
          const getHeader = (name) =>
            headers.find((h) => h.name.toLowerCase() === name.toLowerCase())
              ?.value || "";

          // Extract metadata
          const subject = getHeader("Subject") || "(No Subject)";
          const from = getHeader("From") || "Unknown";
          const to = getHeader("To");
          const replyTo = getHeader("Reply-To");
          const date = getHeader("Date");
          const mailedBy =
            getHeader("Mailed-By") || getHeader("X-Mailer") || "";
          const signedBy = getHeader("Signed-By") || "";
          const security = "Standard encryption (TLS)"; // Static placeholder for now

          // Snippet preview
          const snippet = msg.data.snippet || "";

          return {
            id: m.id,
            subject,
            from,
            to,
            replyTo,
            date,
            mailedBy,
            signedBy,
            security,
            snippet,
            account: accountEmail,
          };
        } catch (innerErr) {
          console.error("Error parsing message:", innerErr.message);
          return null;
        }
      })
    );

    // Filter out any failed/null responses
    res.json({ messages: detailed.filter(Boolean) });
  } catch (err) {
    console.error("Error fetching messages:", err.message);
    res.status(500).json({ error: "Failed to fetch Gmail messages" });
  }
});

// -----------------------------------------------------------
// GET /api/gmail/messages/:id?account=<email>
// -----------------------------------------------------------
// router.get("/gmail/messages/:id", async (req, res) => {
//   try {
//     const { id } = req.params;
//     const accountEmail = req.query.account;
//     if (!accountEmail)
//       return res.status(400).json({ error: "account query param required" });

//     const authClient = await getAuthorizedClientForAccount(
//       accountEmail,
//       req.user.id
//     );
//     const gmail = google.gmail({ version: "v1", auth: authClient });

//     const msgResp = await gmail.users.messages.get({
//       userId: "me",
//       id,
//       format: "full",
//     });

//     const payload = msgResp.data.payload || {};
//     const headers = payload.headers || [];

//     const subject =
//       headers.find((h) => h.name === "Subject")?.value || "(No Subject)";
//     const from =
//       headers.find((h) => h.name === "From")?.value || "Unknown";
//     const date = headers.find((h) => h.name === "Date")?.value || "";

//     // Recursive function to extract body safely
//     function getBody(node) {
//       if (!node) return "";
//       if (node.parts && node.parts.length) {
//         // Prefer text/plain
//         for (const p of node.parts) {
//           if (p.mimeType === "text/plain" && p.body?.data) {
//             return Buffer.from(p.body.data, "base64").toString("utf-8");
//           }
//         }
//         // Recurse deeper
//         for (const p of node.parts) {
//           const inner = getBody(p);
//           if (inner) return inner;
//         }
//       }
//       if (node.body?.data)
//         return Buffer.from(node.body.data, "base64").toString("utf-8");
//       return "";
//     }

//     const body = getBody(payload);

//     res.json({ id, subject, from, date, body, account: accountEmail });
//   } catch (err) {
//     console.error("Error getting message:", err.message);
//     res.status(500).json({ error: "Failed to get message" });
//   }
// });

router.get("/gmail/messages/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const accountEmail = req.query.account;
    if (!accountEmail)
      return res.status(400).json({ error: "account query param required" });

    // ✅ Authorize Gmail API
    const authClient = await getAuthorizedClientForAccount(
      accountEmail,
      req.user.id
    );
    const gmail = google.gmail({ version: "v1", auth: authClient });

    // ✅ Get full message
    const msgResp = await gmail.users.messages.get({
      userId: "me",
      id,
      format: "full",
    });

    const payload = msgResp.data.payload || {};
    const parts = payload.parts || [];
    let htmlBody = "";
    let textBody = "";
    const attachments = [];

    // ───────────────────────────────
    // Recursive MIME parser
    function extractParts(partsArr) {
      for (const part of partsArr) {
        if (part.mimeType === "text/html" && part.body?.data) {
          htmlBody = Buffer.from(part.body.data, "base64").toString("utf8");
        } else if (part.mimeType === "text/plain" && part.body?.data) {
          textBody = Buffer.from(part.body.data, "base64").toString("utf8");
        } else if (part.mimeType?.startsWith("image/") && part.body?.attachmentId) {
          attachments.push({
            id: part.body.attachmentId,
            mimeType: part.mimeType,
            filename: part.filename,
            cid: part.headers?.find((h) => h.name === "Content-ID")?.value,
          });
        } else if (part.parts) {
          extractParts(part.parts);
        }
      }
    }

    extractParts(parts);

    // ───────────────────────────────
    // Inline image embedding (cid → base64)
    for (const attachment of attachments) {
      try {
        const att = await gmail.users.messages.attachments.get({
          userId: "me",
          messageId: id,
          id: attachment.id,
        });

        const data = att.data.data;
        if (data) {
          const base64 = `data:${attachment.mimeType};base64,${data}`;
          const cid = (attachment.cid || "").replace(/[<>]/g, "");
          htmlBody = htmlBody.replaceAll(`cid:${cid}`, base64);
        }
      } catch (err) {
        console.warn(`⚠️ Failed to embed inline image: ${attachment.filename}`, err.message);
      }
    }

    // ───────────────────────────────
    // Extract headers with fallbacks
    const headers = payload.headers || [];
    const findHeader = (name) =>
      headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

    const subject = findHeader("Subject") || "(No Subject)";
    const from = findHeader("From") || "Unknown";
    const to = findHeader("To");
    const replyTo = findHeader("Reply-To");
    const date = findHeader("Date");
    const mailedBy =
      findHeader("Mailed-By") ||
      findHeader("X-Mailer") ||
      from.match(/@([\w.-]+)/)?.[1] ||
      "";
    const signedBy =
      findHeader("Signed-By") ||
      findHeader("DKIM-Signature")?.match(/d=([^;]+)/)?.[1] ||
      "";
    const security = "Standard encryption (TLS)";

    // ───────────────────────────────
    // Response
    res.json({
      id,
      subject,
      from,
      to,
      replyTo,
      date,
      mailedBy,
      signedBy,
      security,
      body: htmlBody || textBody || "(No content)",
      account: accountEmail,
    });
  } catch (err) {
    console.error("❌ Error getting message:", err);
    res.status(500).json({ error: err?.message || "Failed to get message" });
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

    console.log(`🗑️ Disconnected Gmail: ${email} for user ${userId}`);
    res.json({ message: "Account disconnected successfully", email });
  } catch (err) {
    console.error("Error disconnecting account:", err.message);
    res.status(500).json({ error: "Failed to disconnect Gmail account" });
  }
});

// GET /api/gmail/thread/:id?account=<email>
router.get("/gmail/thread/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const accountEmail = req.query.account;
    if (!accountEmail)
      return res.status(400).json({ error: "account query param required" });

    // ✅ Authenticate using the connected Gmail account
    const authClient = await getAuthorizedClientForAccount(accountEmail, req.user.id);
    const gmail = google.gmail({ version: "v1", auth: authClient });

    // ✅ Fetch the entire thread (conversation)
    const threadResp = await gmail.users.threads.get({
      userId: "me",
      id,
      format: "full",
    });

    const threadData = threadResp.data;
    const messages = threadData.messages || [];

    // ✅ Extract clean data from each message in the thread
    const parsedMessages = messages.map((msg) => {
      const headers = msg.payload.headers || [];

      const findHeader = (name) =>
        headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;

      const subject = findHeader("Subject") || "(No Subject)";
      const from = findHeader("From") || "Unknown";
      const to = findHeader("To") || "";
      const date = findHeader("Date") || "";
      const replyTo = findHeader("Reply-To") || "";
      const mailedBy = findHeader("X-Received") || "";
      const signedBy = findHeader("Received-SPF") || "";
      const security = "Standard encryption (TLS)";

      // 🧩 Extract body (HTML or text)
      function getBody(payload) {
        if (!payload) return "";
        if (payload.parts) {
          for (const part of payload.parts) {
            if (part.mimeType === "text/html" && part.body?.data)
              return Buffer.from(part.body.data, "base64").toString("utf-8");
            if (part.parts) {
              const inner = getBody(part);
              if (inner) return inner;
            }
          }
        }
        if (payload.body?.data)
          return Buffer.from(payload.body.data, "base64").toString("utf-8");
        return "";
      }

      const body = getBody(msg.payload);

      return {
        id: msg.id,
        subject,
        from,
        to,
        date,
        replyTo,
        mailedBy,
        signedBy,
        security,
        body,
      };
    });

    res.json({
      threadId: threadData.id,
      messages: parsedMessages,
      account: accountEmail,
    });
  } catch (err) {
    console.error("❌ Error fetching thread:", err);
    res.status(500).json({ error: err?.message || "Failed to fetch thread" });
  }
});



export default router;
