import "dotenv/config";
import "../config/db.js";
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
      "_id userId subject text from to date isIncoming hasDeadline deadlineAt deadlineSource deadlineConfidence isFollowUp followUpWaitingSince"
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

    // 1️⃣ Heuristic evaluation (existing logic)
    const heuristicActionData = evaluateActions(email, threadMeta);

    // 2️⃣ Heuristic-only mode: disable per-email LLM calls to avoid credit burn
    const finalActionData = {
      ...heuristicActionData,
      aiNeedsReply: null,
      aiHasDeadline: null,
      aiIsOverdueFollowUp: null,
      aiConfidence: null,
      aiExplanation: null,
      aiEvaluatedAt: null,
    };

    // 3️⃣ Persist
    await Email.updateOne(
      { _id: email._id },
      { $set: finalActionData }
    );
  }

  console.log("✅ Action re-evaluation finished");
  return {
    processed: candidates.length,
    ranAt: now,
  };
}

/**
 * Execute when run directly (worker mode)
 * This ensures the worker actually runs instead of exiting.
 */
if (process.argv[1] && process.argv[1].includes("actionReevaluation.worker")) {
  (async () => {
    try {
      await runActionReevaluation();
      process.exit(0);
    } catch (err) {
      console.error("❌ Action re-evaluation failed:", err);
      process.exit(1);
    }
  })();
}
