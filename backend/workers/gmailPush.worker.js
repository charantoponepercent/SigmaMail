import "dotenv/config";
import "../config/db.js";
import BullMQ from "bullmq";
import { redis } from "../utils/redis.js";
import { google } from "googleapis";
import EmailAccount from "../models/EmailAccount.js";
import { getAuthorizedClientForAccount } from "../utils/googleClient.js";
import { syncSingleMessage } from "./gmailSyncWorker.js";
import Email from "../models/Email.js";
import Thread from "../models/Thread.js";

const { Worker, Queue } = BullMQ;

// QueueScheduler is not required in BullMQ v4+
const sseQueue = new Queue("sse-events", { connection: redis });


new Worker(
  "gmail-push",
  async (job) => {
    const { emailAddress, historyId } = job.data;
    const account = await EmailAccount.findOne({ email: emailAddress });
    if (!account) return;

    // 🔐 Gmail client
    const auth = await getAuthorizedClientForAccount(
      account.email,
      account.userId
    );

    const gmail = google.gmail({ version: "v1", auth });

    const incomingHistoryId = historyId;

    // ⛔ Skip duplicate / replayed pushes (VERY IMPORTANT)
    if (
      account.lastHistoryId &&
      BigInt(incomingHistoryId) <= BigInt(account.lastHistoryId)
    ) {
      return;
    }

    // 🧠 First push after watch registration — only set cursor
    if (!account.lastHistoryId) {
      account.lastHistoryId = incomingHistoryId;
      await account.save();
      return;
    }

    // 🔁 Incremental sync using previous cursor
    const startHistoryId = account.lastHistoryId;

    const historyRes = await gmail.users.history.list({
      userId: "me",
      startHistoryId,
      historyTypes: ["messageAdded", "labelAdded", "labelRemoved"],
    });

    const histories = historyRes.data.history || [];
    const labelEvents = [];
    const messageIds = new Set();

    for (const h of histories) {
      // New messages
      for (const m of h.messagesAdded || []) {
        messageIds.add(m.message.id);
      }

      // Label added (e.g. UNREAD, STARRED)
      for (const la of h.labelsAdded || []) {
        labelEvents.push({
          messageId: la.message.id,
          labels: la.labelIds,
          type: "added",
        });
      }

      // Label removed (e.g. UNREAD removed => read)
      for (const lr of h.labelsRemoved || []) {
        labelEvents.push({
          messageId: lr.message.id,
          labels: lr.labelIds,
          type: "removed",
        });
      }
    }

    if (labelEvents.length > 0) {
      console.log("🏷️ Label events:", labelEvents);
    }

    // 🔁 Sync read / unread state + thread counters
    for (const ev of labelEvents) {
      if (!ev.labels.includes("UNREAD")) continue;

      const isRead = ev.type === "removed";

      const email = await Email.findOneAndUpdate(
        { messageId: ev.messageId },
        { $set: { isRead } },
        { new: true }
      );

      if (!email) continue;

      const delta = isRead ? -1 : 1;

      await Thread.updateOne(
        { threadId: email.threadId, accountId: email.accountId },
        {
          $inc: { unreadCount: delta },
        }
      );

      // normalize thread state (no negatives)
      await Thread.updateOne(
        {
          threadId: email.threadId,
          accountId: email.accountId,
          unreadCount: { $lte: 0 },
        },
        {
          $set: { unreadCount: 0, hasUnread: false },
        }
      );

      await Thread.updateOne(
        {
          threadId: email.threadId,
          accountId: email.accountId,
          unreadCount: { $gt: 0 },
        },
        {
          $set: { hasUnread: true },
        }
      );
      // 🔔 Queue SSE event for read/unread change
      await sseQueue.add("EMAIL_READ_STATE", {
        userId: email.userId.toString(),
        data: {
          emailId: email._id,
          threadId: email.threadId,
          isRead,
        },
      });
    }

    for (const messageId of messageIds) {
      // 🧱 Idempotency: skip if already saved
      const exists = await Email.findOne({
        messageId,
        accountId: account._id,
      }).select("_id");

      if (exists) {
        continue;
      }

      const emailDoc = await syncSingleMessage(gmail, messageId, account);

      if (!emailDoc) continue;


      await sseQueue.add("NEW_EMAIL", {
        userId: account.userId.toString(),
        data: emailDoc,
      });
    }

    // ✅ Advance cursor only AFTER processing
    account.lastHistoryId = incomingHistoryId;
    await account.save();
  },
  { connection: redis }
);