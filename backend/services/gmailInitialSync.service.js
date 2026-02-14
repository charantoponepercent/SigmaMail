import { google } from "googleapis";
import EmailAccount from "../models/EmailAccount.js";
import { getAuthorizedClientForAccount } from "../utils/googleClient.js";
import { Queue } from "bullmq";
import { getRedisClient, shouldUseRedisForQueues } from "../utils/redis.js";

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

export async function runInitialSync(accountId) {
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

  // 🔥 Hand off to the worker from Step 2
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
}
