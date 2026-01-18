

/**
 * AI Decision Evaluator (Today’s Decisions)
 *
 * This module is intentionally PURE:
 * - No DB access
 * - No queues
 * - No network calls (yet)
 *
 * It receives:
 *  - email content
 *  - heuristic outputs
 *
 * And returns:
 *  - AI-assisted decisions
 */

export function evaluateWithAI({
  email,
  heuristics,
}) {
  if (!email || !heuristics) {
    throw new Error("evaluateWithAI requires email and heuristics");
  }

  /**
   * Input normalization
   */
  const input = {
    subject: email.subject || "",
    text:
      email.textBody ||
      email.text ||
      email.snippet ||
      "",
    from: email.from || "",
    to: email.to || "",
    date: email.date || null,

    // heuristic signals
    needsReply: heuristics.needsReply ?? false,
    needsReplyScore: heuristics.needsReplyScore ?? 0,

    hasDeadline: heuristics.hasDeadline ?? false,
    deadlineAt: heuristics.deadlineAt ?? null,

    isFollowUp: heuristics.isFollowUp ?? false,
    isOverdueFollowUp: heuristics.isOverdueFollowUp ?? false,
  };

  /**
   * Placeholder AI result (heuristic-backed for now)
   * Real AI call will be plugged in later
   */
  const aiResult = {
    aiNeedsReply: input.needsReply,
    aiHasDeadline: input.hasDeadline,
    aiIsOverdueFollowUp: input.isOverdueFollowUp,

    aiConfidence: 0.5,
    aiExplanation: buildExplanation(input),
    aiEvaluatedAt: new Date(),
  };

  return aiResult;
}

/**
 * Build a human-readable explanation
 * (Used even before real AI is added)
 */
function buildExplanation(input) {
  if (input.isOverdueFollowUp) {
    return "You are waiting for a reply on an earlier message.";
  }

  if (input.hasDeadline) {
    return "This email mentions a deadline that is approaching.";
  }

  if (input.needsReply) {
    return "This email contains a question or request that likely needs your response.";
  }

  return "This email does not appear to require action.";
}