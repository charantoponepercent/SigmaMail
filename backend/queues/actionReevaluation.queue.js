import { Queue } from "bullmq";
import { getRedisClient, shouldUseRedisForQueues } from "../utils/redis.js";

let actionReevaluationQueue = null;

export function getActionReevaluationQueue() {
  if (actionReevaluationQueue) return actionReevaluationQueue;
  if (!shouldUseRedisForQueues()) {
    throw new Error("Redis queues are disabled. Cannot enqueue action reevaluation jobs.");
  }
  const redis = getRedisClient({ required: true, purpose: "action-reevaluation queue" });
  actionReevaluationQueue = new Queue("action-reevaluation", {
    connection: redis,
  });
  return actionReevaluationQueue;
}

export async function enqueueActionReevaluationJob(data = {}, options = {}) {
  const queue = getActionReevaluationQueue();
  await queue.add("action-reevaluation", data, options);
}
