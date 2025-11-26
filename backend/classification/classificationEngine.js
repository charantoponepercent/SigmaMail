// backend/classification/classificationEngine.js
import { classifyHeuristic } from "./heuristics.js";
import CATEGORIZATION_RULES from "./categorizationRules.js";
import { generateEmbedding } from "../utils/embedding.js";
import Category from "../models/Category.js";

/**
 * classificationEngine
 * - L1 (heuristic) via classifyHeuristic
 * - L2 phrase rules
 * - L3 sender rules already covered by heuristic
 * - L4 exclusions
 * - Embedding semantic similarity vs seeded category embeddings
 * - Weighted fusion + normalization
 */

// Helpers
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

function applyExclusionRules(text) {
  const low = normalizeText(text);
  const penalties = {};
  CATEGORIZATION_RULES.CATEGORY_LIST.forEach(c => (penalties[c] = 0));
  const ex = CATEGORIZATION_RULES.EXCLUSION_RULES_L4 || {};

  (ex.Promotional_Disguise || []).forEach(p => {
    if (low.includes(p.toLowerCase())) {
      // demote promotional-looking content from non-promo categories
      CATEGORIZATION_RULES.CATEGORY_LIST.forEach(c => {
        if (c !== "Promotions" && c !== "Spam") penalties[c] -= 1;
      });
      penalties["Promotions"] += 0.5;
    }
  });

  (ex.Spam_Signals || []).forEach(p => {
    if (low.includes(p.toLowerCase())) {
      penalties["Spam"] += 3;
    }
  });

  (ex.Cross_Category_Conflict || []).forEach(p => {
    if (low.includes(p.toLowerCase())) {
      // slightly demote promotions and social to avoid false positives
      penalties["Promotions"] -= 1;
      penalties["Social"] -= 0.5;
    }
  });

  return penalties;
}

// semantic similarity vs category embeddings
async function semanticSimilarity(embedding) {
  const out = {};
  if (!embedding || !Array.isArray(embedding)) {
    CATEGORIZATION_RULES.CATEGORY_LIST.forEach(c => (out[c] = 0));
    return out;
  }

  const cats = await Category.find({}).lean();
  // If DB has no category embeddings, return zeros
  if (!cats || cats.length === 0) {
    CATEGORIZATION_RULES.CATEGORY_LIST.forEach(c => (out[c] = 0));
    return out;
  }

  for (const cat of CATEGORIZATION_RULES.CATEGORY_LIST) out[cat] = 0;

  for (const c of cats) {
    if (!c.embedding || !Array.isArray(c.embedding)) continue;
    // cosine similarity
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < embedding.length && i < c.embedding.length; i++) {
      dot += embedding[i] * c.embedding[i];
      na += embedding[i] * embedding[i];
      nb += c.embedding[i] * c.embedding[i];
    }
    const sim = (na === 0 || nb === 0) ? 0 : dot / (Math.sqrt(na) * Math.sqrt(nb));
    out[c.name] = Number(sim.toFixed(6));
  }

  return out;
}

// Weighted fusion and normalization
function mergeScores({ heuristic, phrase, semantic, exclusion }) {
  // Tunable weights
  const W = {
    HEURISTIC: 0.25, // L1 + L3
    PHRASE: 0.25,    // L2
    SEMANTIC: 0.6,   // Embedding strong signal
    EXCLUSION: 0.6,  // applied as additive penalty/boost
  };

  const final = {};
  for (const cat of CATEGORIZATION_RULES.CATEGORY_LIST) {
    const h = heuristic?.scores?.[cat] || 0;
    const p = phrase?.[cat] || 0;
    const s = semantic?.[cat] || 0;
    const e = exclusion?.[cat] || 0;

    // Note: exclusion contains positive (for promotions) and negative values for demotion
    final[cat] = W.HEURISTIC * h + W.PHRASE * p + W.SEMANTIC * s + W.EXCLUSION * e;
  }

  // Normalize scores to 0..1
  const vals = Object.values(final);
  const maxV = Math.max(...vals);
  const minV = Math.min(...vals);
  const normalized = {};
  for (const cat of Object.keys(final)) {
    if (maxV === minV) normalized[cat] = final[cat] > 0 ? 1 : 0;
    else normalized[cat] = Number(((final[cat] - minV) / (maxV - minV)).toFixed(4));
  }

  // Build ordered candidate list
  const candidates = Object.entries(normalized)
    .map(([name, score]) => ({ name, score }))
    .sort((a, b) => b.score - a.score);

  const top = candidates[0] || { name: "General", score: 0 };

  return {
    top: top.name,
    topScore: Number((top.score || 0).toFixed(4)),
    candidates,
    fusedRaw: final
  };
}

/**
 * classifyEmailFull(email)
 * email: { subject, from, text, plainText, embedding (optional) }
 */
export async function classifyEmailFull(email = {}) {
  const combinedText = `${email.subject || ""}\n${email.text || ""}\n${email.plainText || ""}`.trim().toLowerCase();

  // L1 + L3 heuristic (fast)
  const heuristic = classifyHeuristic({
    subject: email.subject,
    textBody: email.text,
    snippet: email.snippet || "",
    from: email.from,
  });

  // L2 phrase rules
  const phrase = applyPhraseRules(combinedText);

  // embedding (if not provided, attempt to generate; handle failures)
  let embedding = email.embedding || null;
  if (!embedding) {
    try {
      embedding = await generateEmbedding(combinedText);
    } catch (err) {
      // embedding generation failed — continue with zeros for semantic
      embedding = null;
    }
  }

  // semantic similarity scores
  const semantic = await semanticSimilarity(embedding);

  // exclusion penalties/adjustments
  const exclusion = applyExclusionRules(combinedText);

  // merge and normalize
  const merged = mergeScores({ heuristic, phrase, semantic, exclusion });

  // Build full debug result
  return {
    top: merged.top,
    topScore: merged.topScore,
    candidates: merged.candidates,
    heuristic,
    phrase,
    semantic,
    exclusion,
    debug: {
      weights: { heuristic: 0.25, phrase: 0.25, semantic: 0.6, exclusion: 0.6 },
      fusedRaw: merged.fusedRaw,
    }
  };
}

export default { classifyEmailFull };