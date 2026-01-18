

import { NEEDS_REPLY_THRESHOLD } from "./types.js";

/**
 * Needs Reply evaluation
 * Uses cheap heuristics first.
 * AI can later boost the score if needed (not implemented here).
 */
export function evaluateNeedsReply(email, thread) {
  const result = {
    needsReply: false,
    needsReplyScore: 0,
    needsReplyReason: null,
  };

  if (!email) return result;

  // Only incoming emails can need a reply
  if (!email.isIncoming) return result;

  // If user already replied in the thread, no reply needed
  if (thread && thread.lastMessageFrom === "me") {
    return result;
  }

  let score = 0;

  const body = (email.text || "").toLowerCase();
  const subject = (email.subject || "").toLowerCase();

  // Heuristic 1: Question mark
  if (body.includes("?") || subject.includes("?")) {
    score += 0.4;
    result.needsReplyReason = "question";
  }

  // Heuristic 2: Action / request words
  const actionPhrases = [
    "please",
    "can you",
    "could you",
    "let me know",
    "confirm",
    "reply",
    "respond",
  ];

  if (actionPhrases.some((p) => body.includes(p))) {
    score += 0.4;
    result.needsReplyReason = "request";
  }

  // Cap score at 1
  score = Math.min(score, 1);

  result.needsReplyScore = score;

  if (score >= NEEDS_REPLY_THRESHOLD) {
    result.needsReply = true;
  }

  return result;
}