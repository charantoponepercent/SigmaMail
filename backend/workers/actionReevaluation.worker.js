import "dotenv/config";
import "../config/db.js";
import Email from "../models/Email.js";
import { evaluateActions } from "../actions/index.js";

import { evaluateWithAI } from "../ai/aiDecisionEvaluator.js";
import { callAI } from "../ai/aiClient.js";
import { TODAYS_DECISION_PROMPT } from "../ai/prompts/todaysDecision.prompt.js";

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

    // 1️⃣ Heuristic evaluation (existing logic)
    const heuristicActionData = evaluateActions(email, threadMeta);

    // 2️⃣ Decide if AI should run (borderline / actionable cases)
    let aiResult = null;
    const shouldRunAI =
      heuristicActionData.needsReply ||
      heuristicActionData.hasDeadline ||
      heuristicActionData.isOverdueFollowUp ||
      (heuristicActionData.needsReplyScore > 0.3 &&
        heuristicActionData.needsReplyScore < 0.7);

    if (shouldRunAI) {
      try {
        aiResult = await callAI({
          systemPrompt: TODAYS_DECISION_PROMPT,
          userPayload: {
            email: {
              subject: email.subject,
              text: email.text,
              from: email.from,
              to: email.to,
              date: email.date,
            },
            heuristics: heuristicActionData,
          },
        });
      } catch (err) {
        console.warn(
          "⚠️ AI evaluation failed for email:",
          email._id.toString(),
          err.message
        );
      }
    }

    // 3️⃣ Merge heuristic + AI results
    const finalActionData = {
      ...heuristicActionData,
      ...(aiResult
        ? {
            aiNeedsReply: aiResult.aiNeedsReply,
            aiHasDeadline: aiResult.aiHasDeadline,
            aiIsOverdueFollowUp: aiResult.aiIsOverdueFollowUp,
            aiConfidence: aiResult.aiConfidence,
            aiExplanation: aiResult.aiExplanation,
            aiEvaluatedAt: new Date(),
          }
        : {}),
    };

    // console.log("Final Action Data : ",finalActionData)

    // 4️⃣ Persist
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