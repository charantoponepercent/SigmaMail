import { FOLLOW_UP_THRESHOLD_HOURS } from "./types.js";

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

export function evaluateFollowUp(email, thread) {
  const result = {
    isFollowUp: false,
    followUpWaitingSince: null,
    isOverdueFollowUp: false,
    confidence: 0,
    matchedSnippet: null // UI can show: "Waiting on: 'Let me know...'"
  };

  if (!email || !thread) return result;

  // 1. Ownership Check
  // If "they" sent the last message, the ball is in "my" court (Task, not Follow-up)
  if (thread.lastMessageFrom !== "me") {
    return result;
  }

  // 2. Text Analysis
  const text = `${email.subject || ""} \n ${email.text || ""}`;
  
  // Calculate "Waiting Score" (0.0 to 1.0)
  const analysis = calculateWaitingScore(text);
  
  // 3. Threshold Decision
  // We need a decent confidence (e.g. > 0.5) to bother the user with a "Waiting" label
  if (analysis.score > 0.5) {
    result.isFollowUp = true;
    result.confidence = analysis.score;
    result.matchedSnippet = analysis.snippet;
    result.followUpWaitingSince = thread.lastMessageAt;
  }

  // 4. Overdue Calculation
  // Only calculate overdue status if it IS actually a follow-up
  if (result.isFollowUp && thread.lastMessageAt) {
    const now = Date.now();
    const waitingSince = new Date(thread.lastMessageAt).getTime();
    const hoursWaiting = (now - waitingSince) / (1000 * 60 * 60);

    if (hoursWaiting >= FOLLOW_UP_THRESHOLD_HOURS) {
      result.isOverdueFollowUp = true;
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

  // A. Check for specific "Action Phrases" (Strongest Signal)
  for (const regex of ACTION_REQUEST_REGEX) {
    const match = text.match(regex);
    if (match) {
      score += 0.8; // Very high confidence
      snippet = match[0];
      break; // Found a strong reason, stop looking
    }
  }

  // B. Check for Question Marks (Medium Signal)
  // We look for sentences ending in '?'
  if (score < 0.8) {
    // Split into sentences (crude but effective for heuristics)
    const sentences = text.split(/[.!?\n]/);
    for (const s of sentences) {
      if (s.trim().endsWith("?")) {
        score += 0.5;
        // If the question is short, it's likely a real question. 
        // If it's very long, might be rhetorical or a link.
        if (s.length < 150) score += 0.2; 
        
        snippet = s.trim() + "?";
        break;
      }
    }
  }

  // C. Negative Scoring (Closing the loop)
  // If I said "No reply needed", kill the score.
  for (const regex of CLOSING_PHRASES) {
    if (regex.test(text)) {
      score -= 1.0; // Hard penalty
      snippet = null;
    }
  }

  return { 
    score: Math.min(Math.max(score, 0), 1), // Clamp between 0 and 1
    snippet 
  };
}