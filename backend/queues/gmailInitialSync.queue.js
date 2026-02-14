import { Queue } from "bullmq";
import { getRedisClient, shouldUseRedisForQueues } from "../utils/redis.js";

let gmailInitialSyncQueue = null;

function getGmailInitialSyncQueue() {
  if (gmailInitialSyncQueue) return gmailInitialSyncQueue;
  if (!shouldUseRedisForQueues()) {
    throw new Error("Redis queues are disabled. Cannot enqueue initial sync jobs.");
  }
  const redis = getRedisClient({ required: true, purpose: "gmail-initial-sync queue" });
  gmailInitialSyncQueue = new Queue("gmail-initial-sync", {
    connection: redis,
  });
  return gmailInitialSyncQueue;
}

export async function enqueueInitialSync(accountId) {
  const queue = getGmailInitialSyncQueue();
  await queue.add(
    "initial-sync",
    { accountId },
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
