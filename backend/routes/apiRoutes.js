// backend/routes/apiRoutes.js
import express from "express";
import User from "../models/User.js";
import EmailAccount from "../models/EmailAccount.js";
import { google } from "googleapis";
import { getAuthorizedClientForAccount } from "../utils/googleClient.js";

const router = express.Router();

/**
 * SIMPLE dev auth middleware:
 * - Reads header 'x-user-email' to identify app user.
 * - In production replace with JWT-based requireAuth that sets req.user = { id, email }.
 */
async function devAuth(req, res, next) {
  const userEmail = req.header("x-user-email");
  if (!userEmail) return res.status(401).json({ error: "Missing x-user-email header (dev auth)" });
  let user = await User.findOne({ email: userEmail });
  if (!user) user = await User.create({ email: userEmail, name: userEmail.split("@")[0] });
  req.user = { id: user._id.toString(), email: user.email };
  next();
}
router.use(devAuth);

// GET /api/accounts -> list connected accounts for current user
router.get("/accounts", async (req, res) => {
  const accounts = await EmailAccount.find({ userId: req.user.id }).select("-refreshToken -accessToken");
  res.json({ accounts });
});

// GET /api/gmail/messages?account=<email>&max=20
router.get("/gmail/messages", async (req, res) => {
  try {
    const accountEmail = req.query.account;
    if (!accountEmail) return res.status(400).json({ error: "account query param required" });

    const authClient = await getAuthorizedClientForAccount(accountEmail, req.user.id);
    const gmail = google.gmail({ version: "v1", auth: authClient });

    const maxResults = parseInt(req.query.max || "20", 10);
    const listResp = await gmail.users.messages.list({ userId: "me", maxResults });

    const msgs = listResp.data.messages || [];

    // fetch metadata headers efficiently
    const detailed = await Promise.all(msgs.map(async (m) => {
      const msg = await gmail.users.messages.get({
        userId: "me",
        id: m.id,
        format: "metadata",
        metadataHeaders: ["Subject", "From", "Date"],
      });

      const headers = msg.data.payload?.headers || [];
      const subject = headers.find(h => h.name === "Subject")?.value || "(No Subject)";
      const from = headers.find(h => h.name === "From")?.value || "Unknown";
      const date = headers.find(h => h.name === "Date")?.value || "";

      return { id: m.id, subject, from, date, account: accountEmail };
    }));

    res.json({ messages: detailed });
  } catch (err) {
    console.error("Error fetching messages:", err?.message || err);
    res.status(500).json({ error: err?.message || "Failed" });
  }
});

// GET /api/gmail/messages/:id?account=<email>
router.get("/gmail/messages/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const accountEmail = req.query.account;
    if (!accountEmail) return res.status(400).json({ error: "account query param required" });

    const authClient = await getAuthorizedClientForAccount(accountEmail, req.user.id);
    const gmail = google.gmail({ version: "v1", auth: authClient });

    const msgResp = await gmail.users.messages.get({ userId: "me", id, format: "full" });
    const payload = msgResp.data.payload || {};
    const headers = payload.headers || [];
    const subject = headers.find(h => h.name === "Subject")?.value || "(No Subject)";
    const from = headers.find(h => h.name === "From")?.value || "Unknown";
    const date = headers.find(h => h.name === "Date")?.value || "";

    // recursion safe body extraction
    function getBody(payloadNode) {
      if (!payloadNode) return "";
      if (payloadNode.parts && payloadNode.parts.length) {
        // prefer text/plain
        for (const p of payloadNode.parts) {
          if (p.mimeType === "text/plain" && p.body?.data) {
            return Buffer.from(p.body.data, "base64").toString("utf-8");
          }
        }
        // else try recursively
        for (const p of payloadNode.parts) {
          const inner = getBody(p);
          if (inner) return inner;
        }
      }
      if (payloadNode.body?.data) return Buffer.from(payloadNode.body.data, "base64").toString("utf-8");
      return "";
    }

    const body = getBody(payload);

    res.json({ id, subject, from, date, body, account: accountEmail });
  } catch (err) {
    console.error("Error getting message:", err?.message || err);
    res.status(500).json({ error: err?.message || "Failed to get message" });
  }
});

export default router;
