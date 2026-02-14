import express from "express";
import { enqueueGmailPushJob } from "../queues/gmailPush.queue.js";
import {
  isRedisLimitExceededError,
  shouldUseRedisForQueues,
} from "../utils/redis.js";

const router = express.Router();
const DEBUG_REALTIME = true;

// Pub/Sub pushes JSON
router.post("/gmail", async (req, res) => {
  try {
    if (!shouldUseRedisForQueues()) {
      return res.status(204).end();
    }

    const msg = req.body?.message;
    if (!msg?.data) {
      return res.status(204).end();
    }

    const decoded = Buffer.from(msg.data, "base64").toString("utf8");
    const payload = JSON.parse(decoded);
    if (DEBUG_REALTIME) {
      console.log("[Realtime] gmail webhook received", payload);
    }

    // payload: { emailAddress, historyId }
    try {
      await enqueueGmailPushJob(payload);
    } catch (err) {
      if (isRedisLimitExceededError(err)) {
        // Avoid Pub/Sub retry storms while Redis is over quota.
        console.warn("⚠️ Skipping gmail-push enqueue due to Redis request limit.");
        return res.status(204).end();
      }
      throw err;
    }

    res.status(204).end(); // IMPORTANT: Pub/Sub expects 2xx
  } catch (err) {
    console.error("❌ Gmail webhook error:", err);
    res.status(500).end();
  }
});

export default router;
