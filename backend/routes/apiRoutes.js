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

    // ✅ Get authorized Gmail API client for this user & account
    const authClient = await getAuthorizedClientForAccount(
      accountEmail,
      req.user.id
    );
    const gmail = google.gmail({ version: "v1", auth: authClient });

    const maxResults = parseInt(req.query.max || "20", 10);
    const listResp = await gmail.users.messages.list({
      userId: "me",
      maxResults,
    });

    const msgs = listResp.data.messages || [];

    // ✅ Fetch headers for each message
    const detailed = await Promise.all(
      msgs.map(async (m) => {
        const msg = await gmail.users.messages.get({
          userId: "me",
          id: m.id,
          format: "metadata",
          metadataHeaders: ["Subject", "From", "Date"],
        });

        const headers = msg.data.payload?.headers || [];
        const subject =
          headers.find((h) => h.name === "Subject")?.value || "(No Subject)";
        const from =
          headers.find((h) => h.name === "From")?.value || "Unknown";
        const date = headers.find((h) => h.name === "Date")?.value || "";

        return { id: m.id, subject, from, date, account: accountEmail };
      })
    );

    res.json({ messages: detailed });
  } catch (err) {
    console.error("Error fetching messages:", err.message);
    res.status(500).json({ error: "Failed to fetch Gmail messages" });
  }
});

// -----------------------------------------------------------
// GET /api/gmail/messages/:id?account=<email>
// -----------------------------------------------------------
router.get("/gmail/messages/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const accountEmail = req.query.account;
    if (!accountEmail)
      return res.status(400).json({ error: "account query param required" });

    const authClient = await getAuthorizedClientForAccount(
      accountEmail,
      req.user.id
    );
    const gmail = google.gmail({ version: "v1", auth: authClient });

    const msgResp = await gmail.users.messages.get({
      userId: "me",
      id,
      format: "full",
    });

    const payload = msgResp.data.payload || {};
    const headers = payload.headers || [];

    const subject =
      headers.find((h) => h.name === "Subject")?.value || "(No Subject)";
    const from =
      headers.find((h) => h.name === "From")?.value || "Unknown";
    const date = headers.find((h) => h.name === "Date")?.value || "";

    // Recursive function to extract body safely
    function getBody(node) {
      if (!node) return "";
      if (node.parts && node.parts.length) {
        // Prefer text/plain
        for (const p of node.parts) {
          if (p.mimeType === "text/plain" && p.body?.data) {
            return Buffer.from(p.body.data, "base64").toString("utf-8");
          }
        }
        // Recurse deeper
        for (const p of node.parts) {
          const inner = getBody(p);
          if (inner) return inner;
        }
      }
      if (node.body?.data)
        return Buffer.from(node.body.data, "base64").toString("utf-8");
      return "";
    }

    const body = getBody(payload);

    res.json({ id, subject, from, date, body, account: accountEmail });
  } catch (err) {
    console.error("Error getting message:", err.message);
    res.status(500).json({ error: "Failed to get message" });
  }
});

export default router;
