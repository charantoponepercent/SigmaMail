import express from "express";
import { google } from "googleapis";
import { getAuthorizedClientForAccount } from "../utils/googleClient.js";

const router = express.Router();

router.get("/gmail/messages", async (req, res) => {
  try {
    const email = "toptwopercent.ac.in@gmail.com"; // later this will come from logged-in user

    const authClient = await getAuthorizedClientForAccount(email);
    const gmail = google.gmail({ version: "v1", auth: authClient });

    const response = await gmail.users.messages.list({
      userId: "me",
      maxResults: 10,
    });

    const messageList = response.data.messages || [];
    const detailedMessages = await Promise.all(
      messageList.map(async (msg) => {
        const fullMsg = await gmail.users.messages.get({
          userId: "me",
          id: msg.id,
          format: "metadata",
          metadataHeaders: ["Subject", "From"],
        });

        const headers = fullMsg.data.payload.headers;
        const subject = headers.find((h) => h.name === "Subject")?.value || "(No Subject)";
        const from = headers.find((h) => h.name === "From")?.value || "Unknown";

        return { id: msg.id, subject, from };
      })
    );

    res.json({ messages: detailedMessages });
  } catch (err) {
    console.error("❌ Error fetching emails:", err);
    res.status(500).json({ error: "Failed to fetch emails" });
  }
});


function getMessageBody(payload) {
  if (!payload) return "";

  // If message has nested parts (multipart)
  if (payload.parts && payload.parts.length) {
    for (const part of payload.parts) {
      // Prefer plain text part
      if (part.mimeType === "text/plain" && part.body?.data) {
        return Buffer.from(part.body.data, "base64").toString("utf-8");
      }
    }
    // If no plain text, try recursively inside
    for (const part of payload.parts) {
      const inner = getMessageBody(part);
      if (inner) return inner;
    }
  }

  // Fallback: handle simple messages
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }

  return "(No content)";
}

// ✅ Route: Get full message details
router.get("/gmail/messages/:id", async (req, res) => {
  try {
    const email = "toptwopercent.ac.in@gmail.com"; // change later for real user
    const { id } = req.params;

    const authClient = await getAuthorizedClientForAccount(email);
    const gmail = google.gmail({ version: "v1", auth: authClient });

    const msg = await gmail.users.messages.get({
      userId: "me",
      id,
      format: "full",
    });

    const headers = msg.data.payload.headers;
    const subject =
      headers.find((h) => h.name === "Subject")?.value || "(No Subject)";
    const from = headers.find((h) => h.name === "From")?.value || "Unknown";
    const date = headers.find((h) => h.name === "Date")?.value || "";

    const body = getMessageBody(msg.data.payload);

    res.json({ id, subject, from, date, body });
  } catch (err) {
    console.error("❌ Error getting message:", err.message);
    res.status(500).json({ error: err.message });
  }
});



export default router;
