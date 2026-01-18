

import Email from "../models/Email.js";
import { evaluateActions } from "../actions/index.js";

console.log("🚀 ActionReevaluation.worker loaded");

/**
 * Action Re-evaluation Worker
 *
 * Purpose:
 * - Re-evaluates time-based action states
 * - Deadlines crossing "today"
 * - Follow-ups becoming overdue
 *
 * This worker is SAFE to run repeatedly.
 * No Gmail calls. No AI calls.
 */
export async function runActionReevaluation() {
  console.log("🔁 Action re-evaluation started");
  const now = new Date();

  // Fetch only emails that can change state over time
  const candidates = await Email.find({
    $or: [
      { hasDeadline: true },
      { isFollowUp: true },
    ],
  })
    .select(
      "_id subject text date isIncoming hasDeadline deadlineAt deadlineSource deadlineConfidence isFollowUp followUpWaitingSince"
    )
    .lean();

  console.log("📊 Action re-evaluation candidates:", candidates.length);

  for (const email of candidates) {
    console.log("🧠 Re-evaluating email:", email._id.toString());
    // Minimal thread meta reconstruction
    const threadMeta = {
      lastMessageFrom: email.isIncoming ? "other" : "me",
      lastMessageAt: email.followUpWaitingSince || email.date,
    };

    const actionData = evaluateActions(email, threadMeta);

    await Email.updateOne(
      { _id: email._id },
      { $set: actionData }
    );
  }

  console.log("✅ Action re-evaluation finished");
  return {
    processed: candidates.length,
    ranAt: now,
  };
}