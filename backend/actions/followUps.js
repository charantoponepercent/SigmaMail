

import { FOLLOW_UP_THRESHOLD_HOURS } from "./types.js";

/**
 * Follow-up evaluation
 * Determines whether:
 * 1. The email/thread is waiting on someone else
 * 2. The follow-up is overdue
 *
 * This logic is deterministic and does NOT use AI.
 */
export function evaluateFollowUp(email, thread) {
  // Defaults
  const result = {
    isFollowUp: false,
    followUpWaitingSince: null,
    isOverdueFollowUp: false,
  };

  if (!email || !thread) return result;

  // We only care if the last message was sent by the user
  if (thread.lastMessageFrom !== "me") {
    return result;
  }

  // User sent the last reply → waiting on other party
  result.isFollowUp = true;
  result.followUpWaitingSince = thread.lastMessageAt;

  if (!thread.lastMessageAt) {
    return result;
  }

  const now = Date.now();
  const waitingSince = new Date(thread.lastMessageAt).getTime();
  const hoursWaiting = (now - waitingSince) / (1000 * 60 * 60);

  if (hoursWaiting >= FOLLOW_UP_THRESHOLD_HOURS) {
    result.isOverdueFollowUp = true;
  }

  return result;
}