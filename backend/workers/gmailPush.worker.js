import "dotenv/config";
import "../config/db.js";
import { Worker } from "bullmq";
import { redis } from "../utils/redis.js";
import { google } from "googleapis";
import EmailAccount from "../models/EmailAccount.js";
import { getAuthorizedClientForAccount } from "../utils/googleClient.js";
import { syncSingleMessage } from "./gmailSyncWorker.js";

console.log("📡 Gmail Push Worker running");

new Worker(
  "gmail-push",
  async (job) => {
    const { emailAddress, historyId } = job.data;

    console.log("📨 Push received:", emailAddress, historyId);

    const account = await EmailAccount.findOne({ email: emailAddress });
    if (!account) return;

    // 🔐 Gmail client
    const auth = await getAuthorizedClientForAccount(
      account.email,
      account.userId
    );

    const gmail = google.gmail({ version: "v1", auth });

    const incomingHistoryId = historyId;

    // 🧠 First push after watch registration — only set cursor
    if (!account.lastHistoryId) {
      console.log("🧠 Initial history cursor set:", incomingHistoryId);
      account.lastHistoryId = incomingHistoryId;
      await account.save();
      return;
    }

    // 🔁 Incremental sync using previous cursor
    const startHistoryId = account.lastHistoryId;

    const historyRes = await gmail.users.history.list({
      userId: "me",
      startHistoryId,
      historyTypes: ["messageAdded"],
    });

    const histories = historyRes.data.history || [];
    const messageIds = new Set();

    for (const h of histories) {
      for (const m of h.messagesAdded || []) {
        messageIds.add(m.message.id);
      }
    }

    console.log("📥 New messages:", messageIds.size);

    for (const messageId of messageIds) {
      await syncSingleMessage(gmail, messageId, account);
    }

    // ✅ Advance cursor only AFTER processing
    account.lastHistoryId = incomingHistoryId;
    await account.save();
  },
  { connection: redis }
);