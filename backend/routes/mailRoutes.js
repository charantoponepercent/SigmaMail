import express from "express";
import { google } from "googleapis";

const router = express.Router();

router.get("/gmail/messages", async (req, res) => {
  try {
    // For now, use your own test token from OAuth console logs
    const accessToken = "ya29.a0ATi6K2vZXanGayceRcd2_n2cVZV8o4eDSTy1PvqWwQsoNeYiaJ86R7a3znkT5ScEM3qZMud1uLLbw_wWmZQN80Zuw2d78brYapYNcBNlAm7pLqdoxPFMMXSBV3cCqjY-P3jcE8M7n2-P1_2KtoinTKX1-O6QjGuFmV9UfgC5_AV3g11eZFdqf4UsVAXJxwicnp0yzWQaCgYKAWQSARUSFQHGX2Mix2NdobRuyqsiskVutIdtSQ0206";

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // Fetch list of messages
    const response = await gmail.users.messages.list({
      userId: "me",
      maxResults: 10,
    });

    const messageList = response.data.messages || [];

    // Fetch message details (subject, from, snippet)
    const detailedMessages = await Promise.all(
      messageList.map(async (msg) => {
        const fullMsg = await gmail.users.messages.get({
          userId: "me",
          id: msg.id,
          format: "metadata",
          metadataHeaders: ["Subject", "From"],
        });

        const headers = fullMsg.data.payload.headers;
        const subjectHeader = headers.find((h) => h.name === "Subject");
        const fromHeader = headers.find((h) => h.name === "From");

        return {
          id: msg.id,
          subject: subjectHeader ? subjectHeader.value : "(No Subject)",
          from: fromHeader ? fromHeader.value : "Unknown",
          snippet: fullMsg.data.snippet,
        };
      })
    );

    res.json({ messages: detailedMessages });
  } catch (err) {
    console.error("❌ Error fetching emails:", err);
    res.status(500).json({ error: "Failed to fetch emails" });
  }
});

export default router;
