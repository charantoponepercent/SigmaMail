import { Queue } from "bullmq";
import { getRedisClient, shouldUseRedisForQueues } from "../utils/redis.js";

let gmailPushQueue = null;

function getGmailPushQueue() {
  if (gmailPushQueue) return gmailPushQueue;
  if (!shouldUseRedisForQueues()) {
    throw new Error("Redis queues are disabled. Cannot enqueue gmail-push jobs.");
  }
  const redis = getRedisClient({ required: true, purpose: "gmail-push queue" });
  gmailPushQueue = new Queue("gmail-push", { connection: redis });
  return gmailPushQueue;
}

export async function enqueueGmailPushJob(data) {
  const queue = getGmailPushQueue();
  await queue.add("gmail-push", data, {
    attempts: 8,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: { age: 60 * 60, count: 1000 },
    removeOnFail: { age: 24 * 60 * 60, count: 1000 },
  });
}
