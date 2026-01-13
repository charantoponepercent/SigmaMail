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
      removeOnComplete: true,
      attempts: 3,
    }
  );
}