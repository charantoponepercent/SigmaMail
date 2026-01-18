import { NEEDS_REPLY_THRESHOLD } from "./types.js";

/**
 * PRODUCTION 'NEEDS REPLY' DETECTOR (TUNED)
 * Analyzes incoming emails to detect actionable requests vs. informational noise.
 */

// --- CONFIGURATION ---

// 1. STRONG SIGNALS: Explicit requests for action (+0.5 to +0.8)
const STRONG_REQUEST_PATTERNS = [
  /let\s+me\s+know/i,
  /let\s+us\s+know/i,
  /rsvp/i,
  // 🔥 FIX 1: Catch "Can you confirm" explicitly
  /can\s+you\s+confirm/i,
  // 🔥 FIX 2: Broaden confirm to catch "confirm if", "confirm that"
  /confirm\s+(if|that|whether|receipt|attendance|availability)/i,
  // 🔥 FIX 3: Catch "Please ensure" (Common business instruction)
  /please\s+(ensure|process|provide|send)/i,
  /are\s+you\s+(free|available|around)/i,
  /can\s+we\s+meet/i,
  /call\s+me/i,
  /waiting\s+for\s+your/i,
  /thoughts\?/i,
  /updates\?/i,
  /status\s+update/i,
  /action\s+required/i,
  /deadline/i
];

// 2. WEAK SIGNALS: Polite phrases (+0.15)
const POLITE_REQUEST_PATTERNS = [
  /please/i,
  /could\s+you/i,
  /would\s+you/i,
  /can\s+you/i,
  /kindly/i,
  /appreciate/i
];

// 3. NEGATIVE SIGNALS: Automated mail (-1.0)
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

// 4. URGENCY KEYWORDS (Subject line)
const URGENCY_KEYWORDS = [
  "urgent", "asap", "immediate", "important", "action", "priority", "invoice"
];

// 5. QUESTIONS: 5 Ws
const DIRECT_QUESTION_START = /^(who|what|where|when|why|how|is|are|do|does|can|could|would|will)\s/i;


export function evaluateNeedsReply(email, thread) {
  const result = {
    needsReply: false,
    needsReplyScore: 0,
    needsReplyReason: null,
    confidence: 0,
  };

  if (!email) return result;

  // 1. Directionality Check
  // We never need to reply to our own emails
  if (!email.isIncoming) return result;
  
  // If I already replied, the ball is in their court.
  if (thread && thread.lastMessageFrom === "me") {
    return result; 
  }

  const text = (email.text || "").toLowerCase();
  const subject = (email.subject || "").toLowerCase();
  const fullText = `${subject} \n ${text}`;

  // 2. SAFETY CHECK: Automated/Marketing Filter
  if (AUTOMATED_PATTERNS.some(p => text.match(p))) {
    return result; 
  }

  let score = 0;
  const reasons = [];

  // 3. SCORING ENGINE

  // A. Check for Strong Requests
  for (const pattern of STRONG_REQUEST_PATTERNS) {
    if (fullText.match(pattern)) {
      score += 0.5; // Strong Boost
      reasons.push("strong_request");
      break; 
    }
  }

  // B. Check for Question Marks + Sentence Structure
  const questions = fullText.match(/[^.!?\n]+[?]/g);
  if (questions) {
    for (const q of questions) {
      const trimmed = q.trim();
      
      // Short, punchy question?
      if (trimmed.length < 50) {
        score += 0.3;
        reasons.push("short_question");
      }
      
      // Direct Question word?
      if (DIRECT_QUESTION_START.test(trimmed)) {
        score += 0.2;
        reasons.push("direct_question");
      }
    }
    // Base score just for having a question mark
    if (score === 0 || score === 0.5) score += 0.2; 
  }

  // C. Check for Polite Requests
  if (POLITE_REQUEST_PATTERNS.some(p => fullText.match(p))) {
    score += 0.15;
  }

  // D. Urgency Boost (Subject line)
  if (URGENCY_KEYWORDS.some(k => subject.includes(k))) {
    score += 0.35;
    reasons.push("marked_urgent");
  }

  // E. Length Penalty
  if (text.length > 2000) score -= 0.1;
  if (text.length < 200) score += 0.1;


  // 4. FINAL CALCULATION
  score = Math.min(score, 1); // Cap at 1.0
  
  result.needsReplyScore = parseFloat(score.toFixed(2));
  result.needsReplyReason = reasons.join(", ");

  if (score >= NEEDS_REPLY_THRESHOLD) {
    result.needsReply = true;
  }

  return result;
}