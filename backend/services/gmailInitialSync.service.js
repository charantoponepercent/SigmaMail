import { google } from "googleapis";
import EmailAccount from "../models/EmailAccount.js";
import { getAuthorizedClientForAccount } from "../utils/googleClient.js";
import { Queue } from "bullmq";
import { getRedisClient, shouldUseRedisForQueues } from "../utils/redis.js";
import { syncSingleMessage } from "../workers/gmailSyncWorker.js";

let messageSyncQueue = null;

function getMessageSyncQueue() {
  if (messageSyncQueue) return messageSyncQueue;
  if (!shouldUseRedisForQueues()) {
    throw new Error("Redis queues are disabled. Cannot enqueue message sync jobs.");
  }
  const redis = getRedisClient({ required: true, purpose: "gmail-message-sync queue" });
  messageSyncQueue = new Queue("gmail-message-sync", {
    connection: redis,
  });
  return messageSyncQueue;
}

const INITIAL_LIMIT = 120;

async function runInitialSyncInline({ account, gmail, messageIds }) {
  let synced = 0;
  for (const messageId of messageIds) {
    try {
      await syncSingleMessage(gmail, messageId, account);
      synced += 1;
    } catch (err) {
      console.error(
        `❌ Inline initial sync failed for message ${messageId} (${account.email}):`,
        err?.message || err
      );
    }
  }

  account.initialSyncDone = true;
  await account.save();

  return { mode: "inline", synced };
}

export async function runInitialSync(accountId, { forceInline = false } = {}) {
  const account = await EmailAccount.findById(accountId);
  if (!account || account.initialSyncDone) return;

  const authClient = await getAuthorizedClientForAccount(
    account.email,
    account.userId
  );

  const gmail = google.gmail({ version: "v1", auth: authClient });

  const res = await gmail.users.messages.list({
    userId: "me",
    maxResults: INITIAL_LIMIT,
  });

  const messageIds = (res.data.messages || []).map((m) => m.id);

  if (messageIds.length === 0) {
    account.initialSyncDone = true;
    await account.save();
    return;
  }

  if (forceInline || !shouldUseRedisForQueues()) {
    return runInitialSyncInline({ account, gmail, messageIds });
  }

  try {
    // Normal mode: hand off to dedicated worker
    const queue = getMessageSyncQueue();
    await queue.add(
      "sync-messages",
      {
        accountId: account._id,
        messageIds,
      },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 10000,
        },
        removeOnComplete: { age: 24 * 60 * 60, count: 500 },
        removeOnFail: { age: 7 * 24 * 60 * 60, count: 500 },
      }
    );
    return { mode: "queued", enqueued: messageIds.length };
  } catch (err) {
    console.warn(
      "⚠️ Initial sync queue enqueue failed. Falling back to inline sync:",
      err?.message || err
    );
    return runInitialSyncInline({ account, gmail, messageIds });
  }
}
