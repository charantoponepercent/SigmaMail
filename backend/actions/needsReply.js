import { NEEDS_REPLY_THRESHOLD } from "./types.js";
import { isIncomingMessage, getMessageTimestamp } from "./actionUtils.js";

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

// 2. DECISION / APPROVAL TRIGGERS (+0.35)
const DECISION_PATTERNS = [
  /approve/i,
  /sign\s*off/i,
  /green\s*light/i,
  /permission/i,
  /consent/i,
  /need\s+your\s+(decision|input|approval)/i,
  /can\s+we\s+proceed/i,
];

// 3. RESOURCE / DATA REQUESTS (+0.25)
const RESOURCE_PATTERNS = [
  /send\s+over/i,
  /share\s+the/i,
  /forward\s+the/i,
  /provide\s+the/i,
  /attach(ed)?\s+again/i,
  /upload\s+the/i,
  /grant\s+access/i,
];

// 4. WEAK SIGNALS: Polite phrases (+0.15)
const POLITE_REQUEST_PATTERNS = [
  /please/i,
  /could\s+you/i,
  /would\s+you/i,
  /can\s+you/i,
  /kindly/i,
  /appreciate/i
];

// 5. NEGATIVE SIGNALS: Automated or FYI mail (strong penalty)
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
  /manage\s+preferences/i,
  /this\s+is\s+an\s+automated/i,
];

const FYI_ONLY_PATTERNS = [
  /for\s+your\s+information/i,
  /\bfyi\b/i,
  /no\s+reply\s+(needed|required)/i,
  /just\s+sharing/i,
  /just\s+so\s+you\s+know/i,
];

// 4. URGENCY KEYWORDS (Subject line)
const URGENCY_KEYWORDS = [
  "urgent", "asap", "immediate", "important", "action", "priority", "invoice"
];

// 5. QUESTIONS: 5 Ws
const DIRECT_QUESTION_START = /^(who|what|where|when|why|how|is|are|do|does|can|could|would|will)\s/i;


export function evaluateNeedsReply(email, context = {}) {
  const result = {
    needsReply: false,
    needsReplyScore: 0,
    needsReplyReason: null,
    confidence: 0,
    debug: {},
  };

  if (!email) return result;

  // 1. Directionality Check
  // We never need to reply to our own emails
  if (!isIncomingMessage(email, true)) return result;

  if (context?.lastMessageFrom === "me" && context?.lastMessage !== email) {
    return result;
  }

  const text = (email.text || email.plainText || "").toLowerCase();
  const subject = (email.subject || "").toLowerCase();
  const fullText = `${subject}\n${text}`;

  // 2. SAFETY CHECK: Automated/Marketing Filter
  if (AUTOMATED_PATTERNS.some(p => p.test(fullText))) {
    result.debug.automation = true;
    return result;
  }

  let score = 0;
  const reasons = [];

  // 3. SCORING ENGINE

  const addScore = (delta, reason) => {
    if (delta === 0) return;
    score += delta;
    if (reason) reasons.push(reason);
  };

  // A. Strong Requests
  for (const pattern of STRONG_REQUEST_PATTERNS) {
    if (pattern.test(fullText)) {
      addScore(0.55, "strong_request");
      break;
    }
  }

  // B. Decision / Approval words
  if (DECISION_PATTERNS.some(p => p.test(fullText))) {
    addScore(0.35, "decision_needed");
  }

  // C. Resource Requests
  if (RESOURCE_PATTERNS.some(p => p.test(fullText))) {
    addScore(0.25, "resource_request");
  }

  // D. Question Density
  const sentenceQuestions = fullText.match(/[^.!?\n]+[?]/g) || [];
  const questionCount = (fullText.match(/\?/g) || []).length;
  if (questionCount > 0) {
    addScore(Math.min(0.4, questionCount * 0.12), "question_marks");
  }
  for (const q of sentenceQuestions) {
    const trimmed = q.trim();
    if (trimmed.length < 50) addScore(0.2, "short_question");
    if (DIRECT_QUESTION_START.test(trimmed)) addScore(0.15, "direct_question");
  }

  // E. Polite requests (weak boost)
  if (POLITE_REQUEST_PATTERNS.some(p => p.test(fullText))) {
    addScore(0.15, "polite_request");
  }

  // F. Urgency keywords in subject
  if (URGENCY_KEYWORDS.some(k => subject.includes(k))) {
    addScore(0.35, "marked_urgent");
  }

  // G. Attachment Mentions
  if (/attach(ed)?/i.test(fullText) && !(email.attachments || []).length) {
    addScore(0.1, "attachment_reference");
  }

  // H. FYI-only statements
  if (FYI_ONLY_PATTERNS.some(p => p.test(fullText))) {
    addScore(-0.4, "fyi_only");
  }

  // I. Length heuristics
  if (text.length > 2500) addScore(-0.15, "long_body_penalty");
  if (text.length < 180 && questionCount === 0) addScore(-0.2, "too_short");

  // J. Conversation context
  const incomingAt = getMessageTimestamp(email);
  const lastOutgoingAt = context?.lastOutgoingAt ? new Date(context.lastOutgoingAt) : null;
  if (lastOutgoingAt) {
    const hoursSinceReply = (incomingAt - lastOutgoingAt) / (1000 * 60 * 60);
    if (hoursSinceReply > 2 && hoursSinceReply < 96) {
      addScore(0.1, "reply_after_my_last");
    }
  }

  // K. Multiple actionable cues escalate confidence
  if (reasons.includes("strong_request") && (reasons.includes("marked_urgent") || reasons.includes("decision_needed"))) {
    addScore(0.15, "compound_signal");
  }

  // Negative floor + cap
  score = Math.min(Math.max(score, 0), 1);

  result.needsReplyScore = Number(score.toFixed(2));
  result.needsReplyReason = reasons.join(", ");
  result.confidence = result.needsReplyScore;
  result.debug = {
    reasons,
    questionCount,
    textLength: text.length,
  };

  if (score >= NEEDS_REPLY_THRESHOLD) {
    result.needsReply = true;
  }

  return result;
}
