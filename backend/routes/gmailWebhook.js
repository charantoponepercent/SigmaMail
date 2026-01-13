import express from "express";
import { enqueueGmailPushJob } from "../queues/gmailPush.queue.js";

const router = express.Router();

// Pub/Sub pushes JSON
router.post("/gmail", async (req, res) => {
  try {
    const msg = req.body?.message;
    if (!msg?.data) {
      return res.status(204).end();
    }

    const decoded = Buffer.from(msg.data, "base64").toString("utf8");
    const payload = JSON.parse(decoded);

    // payload: { emailAddress, historyId }
    await enqueueGmailPushJob(payload);

    res.status(204).end(); // IMPORTANT: Pub/Sub expects 2xx
  } catch (err) {
    console.error("❌ Gmail webhook error:", err);
    res.status(500).end();
  }
});

export default router;