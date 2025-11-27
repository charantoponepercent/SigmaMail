// backend/classification/heuristics.js
import CATEGORIZATION_RULES from "./categorizationRules.js";

/**
 * Lightweight heuristic classifier (L1 + L3).
 * Fast and deterministic — used inline in the sync worker.
 */

function normalizeText(t = "") {
  return (t || "").toString().toLowerCase();
}

function scoreKeywords(text) {
  const scores = {};
  const lower = normalizeText(text);

  CATEGORIZATION_RULES.CATEGORY_LIST.forEach(c => (scores[c] = 0));

  const rules = CATEGORIZATION_RULES.KEYWORD_RULES_L1 || {};
  for (const [cat, tokens] of Object.entries(rules)) {
    for (const tok of tokens) {
      if (!tok) continue;
      // match whole words more conservatively (avoid substring false positives)
      const pattern = new RegExp(`\\b${escapeRegExp(tok.toLowerCase())}\\b`, "i");
      if (pattern.test(lower)) scores[cat] += 1;
    }
  }
  return scores;
}

function scoreSender(sender) {
  const scores = {};
  const lower = normalizeText(sender || "");
  CATEGORIZATION_RULES.CATEGORY_LIST.forEach(c => (scores[c] = 0));

  const rules = CATEGORIZATION_RULES.SENDER_RULES || {};
  for (const [cat, domains] of Object.entries(rules)) {
    for (const d of domains) {
      if (!d) continue;
      if (lower.includes(d.toLowerCase())) scores[cat] += 2; // stronger weight for sender rule
    }
  }
  return scores;
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * classifyHeuristic(email)
 * email: { subject, textBody, snippet, from }
 */
export function classifyHeuristic(email = {}) {
  const base = {};
  CATEGORIZATION_RULES.CATEGORY_LIST.forEach(c => (base[c] = 0));

  const text = `${email.subject || ""} ${email.textBody || ""} ${email.snippet || ""}`;
  const kw = scoreKeywords(text);
  const sd = scoreSender(email.from);

  for (const cat of CATEGORIZATION_RULES.CATEGORY_LIST) {
    base[cat] = (kw[cat] || 0) + (sd[cat] || 0);
  }

  // choose best (but keep full scores for fusion)
  let best = "General";
  let bestScore = -Infinity;
  for (const cat of Object.keys(base)) {
    if (base[cat] > bestScore) {
      best = cat;
      bestScore = base[cat];
    }
  }

  return {
    scores: base,
    category: best,
    score: Number((bestScore || 0).toFixed(4))
  };
}

export default { classifyHeuristic };