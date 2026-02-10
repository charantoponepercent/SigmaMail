import { Queue } from "bullmq";
import { redis } from "../utils/redis.js";

export const gmailInitialSyncQueue = new Queue("gmail-initial-sync", {
  connection: redis,
});

export async function enqueueInitialSync(accountId) {
  await gmailInitialSyncQueue.add(
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
