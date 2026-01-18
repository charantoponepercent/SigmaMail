import { actionReevaluationQueue } from "../queues/actionReevaluation.queue.js";

export async function scheduleActionReevaluation() {
  await actionReevaluationQueue.add(
    "action-reevaluation",
    {},
    {
      repeat: { every: 30 * 60 * 1000 }, // 30 min
      removeOnComplete: true,
      removeOnFail: true,
    }
  );
}