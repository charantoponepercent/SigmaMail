import { Queue } from "bullmq";
import { redis } from "../utils/redis.js";

export const gmailPushQueue = new Queue("gmail-push", {
  connection: redis,
});

export async function enqueueGmailPushJob(data) {
  await gmailPushQueue.add("gmail-push", data, {
    attempts: 8,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: { age: 60 * 60, count: 1000 },
    removeOnFail: { age: 24 * 60 * 60, count: 1000 },
  });
}
