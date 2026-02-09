import { FOLLOW_UP_THRESHOLD_HOURS } from "./types.js";
import { getMessageTimestamp, isIncomingMessage } from "./actionUtils.js";

/**
 * PRODUCTION FOLLOW-UP DETECTOR
 * Detects if a conversation is in a "Waiting" state based on the user's last message intent.
 * * Strategy:
 * 1. Ownership Check: Confirm user sent the last message.
 * 2. Intent Analysis: Scan for questions (?) and "Action Requests" (e.g., "let me know").
 * 3. Noise Filtering: Ignore simple "Thank you" or "FYI" messages.
 * 4. Time Calculation: Determine if the wait time exceeds the threshold.
 */

// --- CONFIGURATION ---

// High-Signal Triggers: Almost certainly implies we want a reply
const ACTION_REQUEST_REGEX = [
  /let\s+me\s+know/i,
  /looking\s+forward\s+to/i,
  /keep\s+me\s+(posted|updated|informed)/i,
  /updates\?/i,
  /thoughts\?/i,
  /any\s+news/i,
  /can\s+you/i,
  /could\s+you/i,
  /please\s+(send|reply|respond|confirm|check)/i,
  /waiting\s+for/i,
  /what('s| is)\s+the\s+status/i
];

// Passive Triggers: Weaker signals, but combined with a question mark (?) they are strong
const QUESTION_INDICATORS = [
  /\?$/m, // Ends with a question mark (multiline safe)
  /\?\s*$/ // Ends with question mark and whitespace
];

// Closing Triggers: These suggest the conversation is complete (Low score)
const CLOSING_PHRASES = [
  /no\s+reply\s+needed/i,
  /no\s+action\s+required/i,
  /just\s+fyi/i,
  /thanks\s*,?\s*$/i, // "Thanks" at the very end
  /have\s+a\s+(great|good)\s+(weekend|day|night)/i
];

export function evaluateFollowUp(email, context = {}) {
  const result = {
    isFollowUp: false,
    followUpWaitingSince: null,
    isOverdueFollowUp: false,
    confidence: 0,
    matchedSnippet: null, // UI can show: "Waiting on: 'Let me know...'"
    reasoning: [],
  };

  if (!context) return result;

  const lastOutgoing = context.lastOutgoing;
  if (!lastOutgoing) return result;

  const lastOutgoingAt = getMessageTimestamp(lastOutgoing);
  const mostRecentIncoming = context.lastIncoming;
  if (mostRecentIncoming && getMessageTimestamp(mostRecentIncoming) > lastOutgoingAt) {
    return result;
  }

  // Protect against evaluating when the newest email is from them (no follow-up needed)
  if (email && isIncomingMessage(email, true) && context.lastMessage === email) {
    return result;
  }

  const lastOutgoingText = `${lastOutgoing.subject || ""}\n${lastOutgoing.text || lastOutgoing.plainText || ""}`;
  const analysis = calculateWaitingScore(lastOutgoingText);

  // Combine time decay with textual intent
  const now = Date.now();
  const hoursWaiting = (now - lastOutgoingAt.getTime()) / (1000 * 60 * 60);
  const timeBoost = Math.max(0, Math.min(0.35, (hoursWaiting - 4) * 0.02)); // allow a 4h grace period

  const rawScore = Math.min(1, analysis.score + timeBoost);

  if (rawScore > 0.55) {
    result.isFollowUp = true;
    result.followUpWaitingSince = lastOutgoingAt;
    result.confidence = Number(rawScore.toFixed(2));
    result.matchedSnippet = analysis.snippet;
    result.reasoning = analysis.reasons;
  }

  if (result.isFollowUp) {
    result.isOverdueFollowUp = hoursWaiting >= FOLLOW_UP_THRESHOLD_HOURS;
    if (result.isOverdueFollowUp) {
      result.reasoning = [...(result.reasoning || []), "hours_waiting_threshold"];
    }
  }

  return result;
}

/**
 * Helper: Analyzes text to see if it demands a response.
 */
function calculateWaitingScore(text) {
  let score = 0;
  let snippet = null;
  const reasons = [];

  for (const regex of ACTION_REQUEST_REGEX) {
    const match = text.match(regex);
    if (match) {
      score += 0.75;
      snippet = match[0];
      reasons.push("action_request");
      break;
    }
  }

  if (score < 0.75) {
    const sentences = text.split(/[.!?\n]/);
    for (const s of sentences) {
      const trimmed = s.trim();
      if (!trimmed) continue;
      if (trimmed.endsWith("?")) {
        score += 0.45;
        reasons.push("question_mark");
        if (trimmed.length < 150) {
          score += 0.15;
          reasons.push("short_question");
        }
        snippet = `${trimmed}?`.replace(/\?+$/, "?");
        break;
      }
    }
  }

  for (const regex of CLOSING_PHRASES) {
    if (regex.test(text)) {
      score -= 0.8;
      reasons.push("closing_phrase");
      snippet = null;
    }
  }

  return {
    score: Math.min(Math.max(score, 0), 1),
    snippet,
    reasons,
  };
}
