import { NEEDS_REPLY_THRESHOLD } from "./types.js";

/**
 * PRODUCTION 'NEEDS REPLY' DETECTOR
 * Analyzes incoming emails to detect actionable requests vs. informational noise.
 * * * Strategy:
 * 1. Filter Automated/Marketing mail immediately (Negative Signals).
 * 2. Identify Direct Questions (Who/What/When + ?).
 * 3. Identify Imperatives (Command verbs: "Send", "Review", "Confirm").
 * 4. Check formatting (Short emails are usually more actionable).
 */

// --- CONFIGURATION ---

// 1. STRONG SIGNALS: Explicit requests for action (+0.5 to +0.8)
// These usually demand a response.
const STRONG_REQUEST_PATTERNS = [
  /let\s+me\s+know/i,
  /let\s+us\s+know/i,
  /rsvp/i,
  /confirm\s+(receipt|attendance|availability)/i,
  /are\s+you\s+(free|available|around)/i,
  /can\s+we\s+meet/i,
  /call\s+me/i,
  /waiting\s+for\s+your/i,
  /thoughts\?/i,               // "Thoughts?" is a classic executive request
  /updates\?/i,
  /status\s+update/i,
  /action\s+required/i,
  /deadline/i
];

// 2. WEAK SIGNALS: Polite phrases that might imply a request (+0.2 to +0.4)
// These need to be combined with a question mark to trigger the threshold.
const POLITE_REQUEST_PATTERNS = [
  /please/i,
  /could\s+you/i,
  /would\s+you/i,
  /can\s+you/i,
  /kindly/i,
  /appreciate/i
];

// 3. NEGATIVE SIGNALS: Signs this is NOT a personal email (-1.0)
// This is the most important part for a production system.
const AUTOMATED_PATTERNS = [
  /unsubscribe/i,
  /view\s+in\s+browser/i,
  /privacy\s+policy/i,
  /terms\s+of\s+service/i,
  /no-reply@/i,
  /don't\s+reply/i,
  /do\s+not\s+reply/i,
  /automated\s+message/i,
  /receipt/i,
  /order\s+confirmed/i,
  /verify\s+your\s+email/i,
  /manage\s+preferences/i
];

// 4. QUESTIONS: 5 Ws (+0.3)
const DIRECT_QUESTION_START = /^(who|what|where|when|why|how|is|are|do|does|can|could|would|will)\s/i;


export function evaluateNeedsReply(email, thread) {
  const result = {
    needsReply: false,
    needsReplyScore: 0,
    needsReplyReason: null, // 'explicit_request', 'direct_question', 'urgent'
    confidence: 0,
  };

  if (!email) return result;

  // 1. Directionality Check
  // We never need to reply to our own emails
  if (!email.isIncoming) return result;
  
  // If I already replied, the ball is in their court.
  if (thread && thread.lastMessageFrom === "me") {
    return result; // Explicitly false
  }

  const text = (email.text || "").toLowerCase();
  const subject = (email.subject || "").toLowerCase();
  const fullText = `${subject} \n ${text}`;

  // 2. SAFETY CHECK: Automated/Marketing Filter
  // If it's a newsletter, we kill it immediately regardless of questions.
  if (AUTOMATED_PATTERNS.some(p => text.match(p))) {
    // There is a small edge case: "Please unsubscribe me" sent by a human.
    // But generally, headers are better for this. For text-only analysis:
    // If the match is near the BOTTOM, it's a footer -> Ignore.
    // If the match is near the TOP, it's a human request -> Keep.
    // For safety in this MVP, we penalize heavily.
    return result; 
  }

  let score = 0;
  const reasons = [];

  // 3. SCORING ENGINE

  // A. Check for Strong Requests (The "Executive" Check)
  for (const pattern of STRONG_REQUEST_PATTERNS) {
    if (fullText.match(pattern)) {
      score += 0.6;
      reasons.push("strong_request");
      break; // One strong signal is usually enough to establish baseline
    }
  }

  // B. Check for Question Marks + Sentence Structure
  // We analyze the *sentences* ending in ?
  const questions = fullText.match(/[^.!?\n]+[?]/g);
  if (questions) {
    for (const q of questions) {
      const trimmed = q.trim();
      
      // Is it a short, punchy question? (High likelihood of needing answer)
      if (trimmed.length < 50) {
        score += 0.3;
        reasons.push("short_question");
      }
      
      // Does it start with a Direct Question word (Who, What, When...)?
      if (DIRECT_QUESTION_START.test(trimmed)) {
        score += 0.2;
        reasons.push("direct_question");
      }
    }
    // Base score just for having a question mark
    if (score === 0) score += 0.2; 
  }

  // C. Check for Polite Requests
  if (POLITE_REQUEST_PATTERNS.some(p => fullText.match(p))) {
    score += 0.15;
    // Boost if combined with a question mark
    if (questions) score += 0.15;
  }

  // D. Urgency Boost (Subject line)
  if (subject.includes("urgent") || subject.includes("asap") || subject.includes("important")) {
    score += 0.3;
    reasons.push("marked_urgent");
  }

  // E. Length Penalty
  // Super long emails (essays) are often informational. 
  // Short emails are often transactional/requests.
  if (text.length > 2000) score -= 0.1;
  if (text.length < 200) score += 0.1;


  // 4. FINAL CALCULATION
  score = Math.min(score, 1); // Cap at 1.0
  
  result.needsReplyScore = parseFloat(score.toFixed(2));
  result.needsReplyReason = reasons[0] || null;

  if (score >= NEEDS_REPLY_THRESHOLD) {
    result.needsReply = true;
  }

  return result;
}