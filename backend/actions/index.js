

import { evaluateNeedsReply } from "./needsReply.js";
import { evaluateDeadline } from "./deadlines.js";
import { evaluateFollowUp } from "./followUps.js";

/**
 * Orchestrates all Action Intelligence evaluators.
 * This function is pure and side-effect free.
 */
export function evaluateActions(email, thread) {
  if (!email) return {};

  const needsReply = evaluateNeedsReply(email, thread);
  const deadline = evaluateDeadline(email);
  const followUp = evaluateFollowUp(email, thread);

  return {
    // Needs Reply
    needsReply: needsReply.needsReply,
    needsReplyScore: needsReply.needsReplyScore,
    needsReplyReason: needsReply.needsReplyReason,

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
  };
}