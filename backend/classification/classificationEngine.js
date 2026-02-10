// backend/classification/classificationEngine.js
import { classifyHeuristic } from "./heuristics.js";
import CATEGORIZATION_RULES from "./categorizationRules.js";
import { generateEmbedding } from "../utils/embedding.js";
import { CLASSIFICATION_WEIGHTS, CATEGORY_PRIORS, CLASSIFIER_FEATURE_FLAGS, STRUCTURAL_THRESHOLDS } from "./config.js";
import { getCategoryEmbeddings } from "./categoryCache.js";
import { computeFeedbackScoresForEmail } from "./feedbackLearning.js";

/**
 * Unified classification engine
 *
 * Layers:
 *  - L1 (heuristic)
 *  - L2 (phrase rules)
 *  - L3 (sender/domain included in heuristic)
 *  - L4 (exclusion)
 *  - L5 (semantic / embeddings)
 *  - Fusion: normalized, tunable weights, debug-friendly
 */

function normalizeText(t = "") { return (t || "").toString().toLowerCase(); }

function applyPhraseRules(text) {
  const low = normalizeText(text);
  const scores = {};
  const rules = CATEGORIZATION_RULES.KEYWORD_RULES_L2_PHRASES || {};
  CATEGORIZATION_RULES.CATEGORY_LIST.forEach(c => (scores[c] = 0));

  for (const [cat, phrases] of Object.entries(rules)) {
    for (const p of phrases || []) {
      if (!p) continue;
      if (low.includes(p.toLowerCase())) scores[cat] += 3; // stronger signal
    }
  }
  return scores;
}

function extractStructuralSignals(email = {}) {
  const subject = normalizeText(email.subject);
  const text = normalizeText(`${email.text || ""} ${email.plainText || ""}`);
  const rawCombined = `${email.subject || ""}\n${email.text || ""}\n${email.html || ""}\n${email.plainText || ""}`;
  const htmlBlob = (email.html || email.text || "");
  const from = normalizeText(email.from || "");
  const signals = CATEGORIZATION_RULES.STRUCTURAL_SIGNALS || {};
  const scores = {};
  CATEGORIZATION_RULES.CATEGORY_LIST.forEach(c => (scores[c] = 0));

  const boost = (cat, value) => { scores[cat] = (scores[cat] || 0) + value; };

  const containsAny = (haystack, arr = []) => arr.some(tok => tok && haystack.includes(tok.toLowerCase()));

  if (subject && containsAny(subject, signals.NEWSLETTER_SUBJECT_HINTS)) {
    boost("Subscriptions", 1.5);
    boost("Promotions", 0.5);
  }

  if (containsAny(text, signals.NEWSLETTER_FOOTERS)) {
    boost("Subscriptions", 2);
  }

  if (containsAny(text, signals.MARKETING_PLATFORM_MENTIONS)) {
    boost("Subscriptions", 1);
  }

  if (containsAny(text, signals.ATTENTION_PHRASES) || containsAny(text, signals.EXCESSIVE_PUNCTUATION)) {
    boost("Spam", 1.2);
  }

  if (containsAny(text, signals.LINK_SHORTENERS)) {
    boost("Spam", 1.5);
  }

  if (signals.SUSPICIOUS_SENDER_TLDS?.some(tld => from.endsWith(tld))) {
    boost("Spam", 1.3);
  }

  if (containsAny(from, signals.NO_REPLY_IDENTIFIERS)) {
    boost("Subscriptions", 0.7);
  }

  const localPart = (email.from || "").split("@")[0]?.toLowerCase() || "";
  if (signals.BULK_SENDER_LOCALPARTS?.some(lp => localPart.includes(lp))) {
    boost("Subscriptions", 0.6);
  }

  if (containsAny(subject, signals.STEALTH_NEWSLETTER_HINTS) || containsAny(text, signals.STEALTH_NEWSLETTER_HINTS)) {
    boost("Subscriptions", 1.1);
  }

  const linkMatches = rawCombined.match(/https?:\/\/[^\s"')<>]+/gi) || [];
  const thresholds = {
    linkHeavy: signals.THRESHOLDS?.LINK_HEAVY || STRUCTURAL_THRESHOLDS.linkHeavy,
    tableHeavy: signals.THRESHOLDS?.TABLE_HEAVY || STRUCTURAL_THRESHOLDS.tableHeavy,
  };

  if (linkMatches.length >= thresholds.linkHeavy) {
    boost("Promotions", 1.2);
    boost("Subscriptions", 0.6);
  }

  const utmLinks = linkMatches.filter(url => signals.TRACKING_PARAMS?.some(tok => url.toLowerCase().includes(tok)));
  if (utmLinks.length > 0) {
    boost("Subscriptions", 1.2);
    boost("Promotions", 0.8);
  }

  if (linkMatches.some(url => signals.REDIRECT_DOMAINS?.some(dom => url.toLowerCase().includes(dom)))) {
    boost("Spam", 0.7);
    boost("Promotions", 0.6);
  }

  const tableCount = (htmlBlob.match(/<table/gi) || []).length;
  const pixelHint = signals.HIDDEN_PIXEL_HINTS?.some(h => htmlBlob.toLowerCase().includes(h));
  const htmlHeavy = signals.HTML_HEAVY_MARKERS?.some(marker => htmlBlob.toLowerCase().includes(marker));
  if (htmlHeavy && tableCount >= thresholds.tableHeavy) {
    boost("Promotions", 1);
    boost("Subscriptions", 0.5);
  }

  if (pixelHint) {
    boost("Subscriptions", 0.9);
    boost("Spam", 0.5);
  }

  const templateLeak = containsAny(text, signals.TEMPLATE_TOKENS);
  if (templateLeak) {
    boost("Subscriptions", 0.9);
  }

  if (signals.STEALTH_CALL_TO_ACTIONS?.some(phrase => rawCombined.toLowerCase().includes(phrase))) {
    boost("Promotions", 0.7);
    boost("Subscriptions", 0.3);
  }

  if (signals.PROMO_STEALTH_HINTS?.some(phrase => rawCombined.toLowerCase().includes(phrase))) {
    boost("Promotions", 1.6);
    boost("Subscriptions", -0.9);
  }

  if (signals.BILLING_KEYWORDS?.some(term => rawCombined.toLowerCase().includes(term))) {
    boost("Bills", 1.3);
    boost("Finance", 0.4);
    boost("Subscriptions", -0.5);
  }

  if (signals.SOCIAL_SYSTEM_HINTS?.some(hint => rawCombined.toLowerCase().includes(hint))) {
    boost("Social", 1.2);
    boost("Work", -0.3);
  }

  const listUnsubHeader = getHeaderCaseInsensitive(email.headers, "List-Unsubscribe");
  if (listUnsubHeader) {
    boost("Subscriptions", 1.5);
  }

  const emojiPattern = /[\u{1F300}-\u{1FAFF}]/u;
  if (emojiPattern.test(email.subject || "") && (email.subject || "").length <= 60) {
    boost("Promotions", 0.6);
  }

  const hiddenStyle = /(font-size:\s*0|display:\s*none|opacity:\s*0|visibility:\s*hidden)/i.test(htmlBlob);
  if (hiddenStyle && linkMatches.length >= 3) {
    boost("Spam", 0.3);
  }

  const marketingHeaderHit = Object.values(email.headers || {}).some(val =>
    typeof val === "string" && signals.MARKETING_PLATFORM_MENTIONS?.some(tok => val.toLowerCase().includes(tok))
  );
  if (marketingHeaderHit) {
    boost("Subscriptions", 0.8);
    boost("Promotions", 0.8);
  }

  return scores;
}

function getHeaderCaseInsensitive(headers = {}, key) {
  if (!headers) return null;
  const target = key.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === target) return v;
  }
  return null;
}

function applyExclusionRules(text) {
  const low = normalizeText(text);
  const penalties = {};
  CATEGORIZATION_RULES.CATEGORY_LIST.forEach(c => (penalties[c] = 0));
  const ex = CATEGORIZATION_RULES.EXCLUSION_RULES_L4 || {};

  (ex.Promotional_Disguise || []).forEach(p => {
    if (!p) return;
    if (low.includes(p.toLowerCase())) {
      // demote many categories that might be falsely positive; small boost to Promotions if clearly promo
      CATEGORIZATION_RULES.CATEGORY_LIST.forEach(c => {
        if (c !== "Promotions" && c !== "Spam") penalties[c] -= 0.8;
      });
      penalties["Promotions"] += 0.5;
    }
  });

  (ex.Spam_Signals || []).forEach(p => {
    if (!p) return;
    if (low.includes(p.toLowerCase())) {
      penalties["Spam"] += 2.5;
    }
  });

  (ex.Cross_Category_Conflict || []).forEach(p => {
    if (!p) return;
    if (low.includes(p.toLowerCase())) {
      penalties["Promotions"] -= 0.6;
      penalties["Social"] -= 0.4;
    }
  });

  return penalties;
}

async function semanticSimilarity(embedding) {
  const out = {};
  CATEGORIZATION_RULES.CATEGORY_LIST.forEach(c => (out[c] = 0));

  if (!embedding || !Array.isArray(embedding)) return out;

  const cats = await getCategoryEmbeddings();
  if (!cats || cats.length === 0) return out;

  // compute cosine similarity to each category seed (safe numeric)
  for (const c of cats) {
    if (!c.embedding || !Array.isArray(c.embedding)) continue;
    let dot = 0, na = 0, nb = 0;
    const len = Math.min(embedding.length, c.embedding.length);
    for (let i = 0; i < len; i++) {
      dot += embedding[i] * c.embedding[i];
      na += embedding[i] * embedding[i];
      nb += c.embedding[i] * c.embedding[i];
    }
    const denom = Math.sqrt(na) * Math.sqrt(nb);
    const sim = denom === 0 ? 0 : dot / denom;
    out[c.name] = Number(sim.toFixed(6));
  }

  return out;
}

/**
 * mergeScores
 * - Accepts raw layer scores and returns normalized candidate list + top
 */
function mergeScores({ heuristic, phrase, semantic, exclusion, structural, feedback, weights, priors }) {
  const W = {
    HEURISTIC: weights?.heuristic ?? CLASSIFICATION_WEIGHTS.heuristic,
    PHRASE: weights?.phrase ?? CLASSIFICATION_WEIGHTS.phrase,
    SEMANTIC: weights?.semantic ?? CLASSIFICATION_WEIGHTS.semantic,
    EXCLUSION: weights?.exclusion ?? CLASSIFICATION_WEIGHTS.exclusion,
    STRUCTURAL: weights?.structural ?? CLASSIFICATION_WEIGHTS.structural,
    FEEDBACK: weights?.feedback ?? CLASSIFICATION_WEIGHTS.feedback,
  };

  const fusedRaw = {};
  CATEGORIZATION_RULES.CATEGORY_LIST.forEach(cat => {
    const h = heuristic?.scores?.[cat] || 0;
    const p = phrase?.[cat] || 0;
    const s = semantic?.[cat] || 0;
    const e = exclusion?.[cat] || 0;
    const str = structural?.[cat] || 0;
    const fb = feedback?.[cat] || 0;
    const prior = priors?.[cat] ?? CATEGORY_PRIORS[cat] ?? 0;

    // combine: heuristic/phrase are counts (small ints), semantic is cosine [-1..1], exclusion is penalty/boost
    // scale semantic to same range by multiplying by a factor (since it's usually <= 1)
    const semanticScaled = s * 5; // 5 is a chosen scale so cosine ~0.6 => 3.0 which is comparable to phrase signals
    fusedRaw[cat] = (W.HEURISTIC * h)
      + (W.PHRASE * p)
      + (W.SEMANTIC * semanticScaled)
      + (W.EXCLUSION * e)
      + (W.STRUCTURAL * str)
      + (W.FEEDBACK * fb)
      + prior;
  });

  // Normalize fusedRaw to 0..1 for interpretability
  const vals = Object.values(fusedRaw);
  const maxV = Math.max(...vals);
  const minV = Math.min(...vals);
  const normalized = {};
  for (const cat of Object.keys(fusedRaw)) {
    if (maxV === minV) normalized[cat] = fusedRaw[cat] > 0 ? 1 : 0;
    else normalized[cat] = Number(((fusedRaw[cat] - minV) / (maxV - minV)).toFixed(4));
  }

  const candidates = Object.entries(normalized)
    .map(([name, score]) => ({ name, score }))
    .sort((a, b) => b.score - a.score);

  const top = candidates[0] || { name: "General", score: 0 };
  return { top: top.name, topScore: Number((top.score || 0).toFixed(4)), candidates, fusedRaw };
}

/**
 * classifyEmailFull(email)
 * email: { subject, from, text, plainText, embedding (optional) }
 */
export async function classifyEmailFull(email = {}, options = {}) {
  const combinedText = `${email.subject || ""}\n${email.text || ""}\n${email.plainText || ""}`.trim().toLowerCase();
  const disableSemantic = options.disableSemantic ?? !CLASSIFIER_FEATURE_FLAGS.useSemantic;
  const appliedWeights = { ...CLASSIFICATION_WEIGHTS, ...(options.weights || {}) };
  const appliedPriors = { ...CATEGORY_PRIORS, ...(options.priors || {}) };

  // 1) Heuristic (L1 + L3)
  const heuristic = classifyHeuristic({
    subject: email.subject,
    textBody: email.text,
    snippet: email.snippet || "",
    from: email.from,
  });

  // 2) Phrase rules (L2)
  const phrase = applyPhraseRules(combinedText);

  // 3) Embedding: use provided or generate
  let embedding = email.embedding || null;
  if (!disableSemantic && !embedding) {
    try {
      embedding = await generateEmbedding(combinedText);
    } catch (err) {
      embedding = null;
    }
  }

  // 4) Semantic similarity (L5)
  let semantic = {};
  if (!disableSemantic) {
    semantic = await semanticSimilarity(embedding);
  } else {
    CATEGORIZATION_RULES.CATEGORY_LIST.forEach(cat => (semantic[cat] = 0));
  }

  // 5) Exclusion rules (L4)
  const exclusion = applyExclusionRules(combinedText);

  // 6) Structural newsletter/spam signals (post-heuristic, pre-fusion)
  const structural = extractStructuralSignals(email);
  const feedback = await computeFeedbackScoresForEmail({
    userId: options.userId || null,
    email,
  });

  // 7) Merge with tunable weights
  const merged = mergeScores({
    heuristic,
    phrase,
    semantic,
    exclusion,
    structural,
    feedback,
    weights: appliedWeights,
    priors: appliedPriors,
  });

  // return full debug payload
  return {
    top: merged.top,
    topScore: merged.topScore,
    candidates: merged.candidates,
    heuristic,
    phrase,
    semantic,
    exclusion,
    structural,
    feedback,
    debug: {
      weights: appliedWeights,
      fusedRaw: merged.fusedRaw,
      disableSemantic,
      priors: appliedPriors,
    }
  };
}

export default { classifyEmailFull };
