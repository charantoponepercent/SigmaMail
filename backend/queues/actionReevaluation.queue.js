import { Queue, Worker } from "bullmq";
import { redis } from "../utils/redis.js";
import { runActionReevaluation } from "../workers/actionReevaluation.worker.js";

// Queue
export const actionReevaluationQueue = new Queue("action-reevaluation", {
  connection: redis,
});

// Worker
console.log("🚀 Action Reevaluation Worker file loaded");
export const actionReevaluationWorker = new Worker(
  "action-reevaluation",
  async () => {
    await runActionReevaluation();
  },
  { connection: redis }
);