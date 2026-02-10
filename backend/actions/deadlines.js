import * as chrono from 'chrono-node';
import { isIncomingMessage } from "./actionUtils.js";

// --- CONFIGURATION ---

// Threshold: How sure do we need to be to flag this? (0.0 - 1.0)
// 0.6 is usually a good balance for production (catches "tomorrow", filters "born in 1990")
export const DEADLINE_CONFIDENCE_THRESHOLD = 0.68;

// Triggers: Words appearing BEFORE the date that imply urgency
const URGENCY_TRIGGERS = [
  "due", "deadline", "submit", "deliver", "return", 
  "until", "expires", "cutoff", "expect", "finish", 
  "complete", "send", "target", "eod", "end of day",
  "cob", "close of business", "close", "closes"
];

// Noise: Words appearing BEFORE the date that imply history/info (not action)
const NOISE_TRIGGERS = [
  "sent", "received", "born", "dated", "since", "from", 
  "started", "created", "past"
];

// Post-Triggers: Words appearing AFTER the date (e.g., "Friday is the deadline")
const POST_DATE_TRIGGERS = [
  "deadline", "due date", "cutoff"
];

const DEADLINE_CONTEXT_HINTS =
  /\b(due|deadline|submit|send|complete|respond|reply|approve|pay|before|until|cob|eod|close of business|required by|by\s+(today|tomorrow|tonight|eod|cob|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}(?::\d{2})?\s*(am|pm)?|\d{1,2}[/-]\d{1,2}))\b/i;
const AUTOMATION_NOISE_PATTERNS = [
  /unsubscribe/i,
  /newsletter/i,
  /digest/i,
  /view\s+in\s+browser/i,
  /manage\s+preferences/i,
];

const RELATIVE_FALLBACK_PATTERNS = [
  {
    regex: /(due|need|please|kindly|can\s+you|send|share).{0,40}(eod|end of day|close of business|cob)/i,
    resolver: (reference) => {
      const date = new Date(reference);
      date.setHours(17, 0, 0, 0);
      return date;
    },
    snippetLabel: "EOD",
  },
  {
    regex: /(due|need|please|kindly|can\s+you|send|share).{0,40}(tomorrow|tmrw)/i,
    resolver: (reference) => {
      const date = new Date(reference);
      date.setDate(date.getDate() + 1);
      date.setHours(12, 0, 0, 0);
      return date;
    },
    snippetLabel: "tomorrow",
  },
  {
    regex: /(due|need|please|kindly|can\s+you|send|share).{0,40}(end of week|eow|next week)/i,
    resolver: (reference) => {
      const date = new Date(reference);
      const day = date.getDay();
      const daysUntilFriday = (5 - day + 7) % 7 || 5;
      date.setDate(date.getDate() + daysUntilFriday);
      date.setHours(17, 0, 0, 0);
      return date;
    },
    snippetLabel: "end of week",
  },
];

/**
 * PRODUCTION DEADLINE EVALUATOR
 * Uses NLP to extract dates and a proximity scoring engine to determine intent.
 * * @param {Object} email - { subject: string, text: string }
 * @returns {Object} Result object
 */
export function evaluateDeadline(email, context = {}) {
  const result = {
    hasDeadline: false,
    deadlineAt: null,
    deadlineSource: null,     // 'nlp-explicit' | 'nlp-relative'
    deadlineConfidence: 0,
    extractedSnippet: null,   // The specific text found (e.g., "next Friday at 5pm")
    reasoning: null           // Debug info: why did we pick this?
  };

  if (!email || (!email.subject && !email.text)) return result;

  if (context && context.lastMessage === email && !isIncomingMessage(email, true)) {
    return result;
  }

  // 1. Text Normalization
  // We combine subject and body. Subject is weighted heavily in scoring later.
  const subject = email.subject || "";
  const body = email.text || "";
  const fullText = `${subject}\n${body}`; 

  if (
    AUTOMATION_NOISE_PATTERNS.some((pattern) => pattern.test(fullText)) &&
    !DEADLINE_CONTEXT_HINTS.test(fullText)
  ) {
    return result;
  }
  
  // Reference date: "Now". 
  const referenceDate = new Date();

  // 2. NLP Extraction
  // forwardDate: true ensures "Friday" implies the *coming* Friday, not past.
  const parsedResults = chrono.parse(fullText, referenceDate, { forwardDate: true });

  if (parsedResults.length === 0) {
    const fallback = detectRelativeDeadline(fullText, referenceDate);
    if (fallback) {
      result.hasDeadline = true;
      result.deadlineAt = fallback.date;
      result.deadlineSource = 'heuristic-relative';
      result.deadlineConfidence = fallback.score;
      result.extractedSnippet = fallback.snippet;
      result.reasoning = fallback.reasoning;
    }
    return result;
  }

  // 3. Candidate Scoring Engine
  let bestCandidate = null;
  let maxScore = -1;

  for (const match of parsedResults) {
    const dateValue = match.start.date();
    const matchText = match.text; // e.g. "tomorrow", "next Friday"
    const index = match.index;
    
    // --- FILTER: Past Dates ---
    // Allow a 24h grace period (for "due yesterday" if analyzing recent emails), 
    // otherwise ignore past dates.
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (dateValue < yesterday) continue;
    const daysAhead =
      (dateValue.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysAhead > 120) continue;


    // --- SCORING: Context Analysis ---
    let score = 0.2;
    const reasoning = [];
    let contextSignalCount = 0;

    // A. Look Behind (50 chars before the date)
    const startWindow = Math.max(0, index - 50);
    const preContext = fullText.substring(startWindow, index).toLowerCase();

    // B. Look Ahead (30 chars after the date)
    const endWindow = Math.min(fullText.length, index + matchText.length + 30);
    const postContext = fullText.substring(index + matchText.length, endWindow).toLowerCase();

    // CHECK: Urgency Keywords (Pre-date)
    // "Please submit by [Date]"
    if (URGENCY_TRIGGERS.some(w => preContext.includes(w))) {
      score += 0.35;
      reasoning.push("urgency_keyword_pre");
      contextSignalCount += 1;
    }

    // CHECK: Strong Phrases (Pre-date)
    // "Due on", "Due by" - Stronger than just "by"
    if (/due\s(by|on|date)|deadline\sis/.test(preContext)) {
      score += 0.15;
      reasoning.push("strong_phrase");
      contextSignalCount += 1;
    }

    // CHECK: Post-Date Keywords
    // "[Date] is the deadline"
    if (POST_DATE_TRIGGERS.some(w => postContext.includes(w))) {
      score += 0.30;
      reasoning.push("urgency_keyword_post");
      contextSignalCount += 1;
    }

    // CHECK: Noise Reduction
    // "Sent on [Date]" -> Reduce score significantly
    if (NOISE_TRIGGERS.some(w => preContext.includes(w))) {
      score -= 0.45;
      reasoning.push("noise_detected");
    }

    if (contextSignalCount === 0) {
      const contextBlob = `${preContext} ${matchText.toLowerCase()} ${postContext}`;
      if (!DEADLINE_CONTEXT_HINTS.test(contextBlob)) {
        continue;
      }
      score -= 0.1;
      reasoning.push("weak_deadline_context");
    }

    // CHECK: Subject Line Bonus
    // If the date appears early in the text (likely subject or top of body)
    if (index < subject.length + 20) {
      score += 0.15;
      reasoning.push("in_subject_line");
    }

    // CHECK: Specificity Bonus
    // Dates with specific times ("5:00 PM") are more likely deadlines than just "Tuesday"
    if (match.start.isCertain('hour')) {
      score += 0.10;
      reasoning.push("has_specific_time");
    } else {
      // If no time is specified, default deadline to End of Day (17:00 or 23:59)
      // This is a common business logic requirement.
      dateValue.setHours(17, 0, 0, 0); 
    }

    // Cap score at 0.99
    score = Math.min(Math.max(score, 0), 0.99);

    // --- SELECTION: Pick the winner ---
    if (score > maxScore) {
      maxScore = score;
      bestCandidate = {
        date: dateValue,
        text: matchText,
        score: parseFloat(score.toFixed(2)),
        isRelative: !matchText.match(/\d/), // If text has no numbers ("tomorrow"), it's relative
        reasoning: reasoning.join(", ")
      };
    }
  }

  // 4. Final Decision
  if (bestCandidate && maxScore >= DEADLINE_CONFIDENCE_THRESHOLD) {
    result.hasDeadline = true;
    result.deadlineAt = bestCandidate.date;
    result.deadlineSource = bestCandidate.isRelative ? 'nlp-relative' : 'nlp-explicit';
    result.deadlineConfidence = bestCandidate.score;
    result.extractedSnippet = bestCandidate.text;
    result.reasoning = bestCandidate.reasoning;
  }

  return result;
}

function detectRelativeDeadline(fullText, referenceDate = new Date()) {
  const normalized = fullText.toLowerCase();
  for (const pattern of RELATIVE_FALLBACK_PATTERNS) {
    const match = normalized.match(pattern.regex);
    if (!match) continue;
    const resolvedDate = pattern.resolver(referenceDate);
    return {
      date: resolvedDate,
      score: 0.62,
      snippet: match[0] || pattern.snippetLabel,
      reasoning: `relative_${pattern.snippetLabel}`,
    };
  }
  return null;
}
