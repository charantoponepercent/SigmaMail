import { Queue } from "bullmq";
import { redis } from "../utils/redis.js";

export const gmailPushQueue = new Queue("gmail-push", {
  connection: redis,
});

export async function enqueueGmailPushJob(data) {
  await gmailPushQueue.add("gmail-push", data, {
    removeOnComplete: true,
    removeOnFail: true,
  });
}