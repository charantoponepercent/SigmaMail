

import { evaluateNeedsReply } from "./needsReply.js";
import { evaluateDeadline } from "./deadlines.js";
import { evaluateFollowUp } from "./followUps.js";
import { buildActionContext } from "./actionUtils.js";

/**
 * Orchestrates all Action Intelligence evaluators.
 * This function is pure and side-effect free.
 */
export function evaluateActions(email, thread) {
  if (!email) return {};

  const context = buildActionContext(email, thread);
  const needsReply = evaluateNeedsReply(email, context);
  const deadline = evaluateDeadline(email, context);
  const followUp = evaluateFollowUp(email, context);
  const shouldSuppressNeedsReply =
    followUp.isFollowUp && followUp.followUpKind === "incoming_nudge";

  return {
    // Needs Reply
    needsReply: shouldSuppressNeedsReply ? false : needsReply.needsReply,
    needsReplyScore: shouldSuppressNeedsReply ? 0 : needsReply.needsReplyScore,
    needsReplyReason: shouldSuppressNeedsReply
      ? "reclassified_as_followup"
      : needsReply.needsReplyReason,

    // Deadlines
    hasDeadline: deadline.hasDeadline,
    deadlineAt: deadline.deadlineAt,
    deadlineSource: deadline.deadlineSource,
    deadlineConfidence: deadline.deadlineConfidence,

    // Follow-ups
    isFollowUp: followUp.isFollowUp,
    followUpWaitingSince: followUp.followUpWaitingSince,
    isOverdueFollowUp: followUp.isOverdueFollowUp,

    // System
    actionLastEvaluatedAt: new Date(),
    conversationStats: {
      totalMessages: context.messages.length,
      lastMessageFrom: context.lastMessageFrom,
      lastMessageAt: context.lastMessageAt,
      conversationAgeHours: context.conversationAgeHours,
    }
  };
}
