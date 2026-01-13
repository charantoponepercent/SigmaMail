import "dotenv/config";
import "../config/db.js";

import { Worker } from "bullmq";
import { google } from "googleapis";
import { redis } from "../utils/redis.js";

import EmailAccount from "../models/EmailAccount.js";
import { getAuthorizedClientForAccount } from "../utils/googleClient.js";

// 🔥 IMPORTANT: import your EXISTING function
import { syncSingleMessage } from "./gmailSyncWorker.js";

console.log("🚀 Gmail Message Sync Worker started");

new Worker(
  "gmail-message-sync",
  async (job) => {
    const { accountId, messageIds } = job.data;

    if (!accountId || !Array.isArray(messageIds) || messageIds.length === 0) {
      return;
    }

    // 1️⃣ Load account
    const account = await EmailAccount.findById(accountId);
    if (!account) return;

    // 2️⃣ Gmail client (reuse your existing auth helper)
    const authClient = await getAuthorizedClientForAccount(
      account.email,
      account.userId
    );

    const gmail = google.gmail({ version: "v1", auth: authClient });

    // 3️⃣ Process messages (SEQUENTIAL = SAFE)
    for (const messageId of messageIds) {
      try {
        await syncSingleMessage(gmail, messageId, account);
      } catch (err) {
        console.error(
          `❌ Failed to sync message ${messageId} for ${account.email}`,
          err.message
        );
      }
    }
  },
  {
    connection: redis,
    concurrency: 1, // 🔒 IMPORTANT: avoid Gmail + Cloudinary race issues
  }
);