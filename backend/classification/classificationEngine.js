// backend/classification/classificationEngine.js
import { classifyHeuristic } from "./heuristics.js";
import CATEGORIZATION_RULES from "./categorizationRules.js";
import { generateEmbedding } from "../utils/embedding.js";
import Category from "../models/Category.js";

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

  const cats = await Category.find({}).lean();
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
function mergeScores({ heuristic, phrase, semantic, exclusion, weights }) {
  // default safe weights (tunable) — sum not required but we normalize after fusion
  const W = {
    HEURISTIC: weights?.heuristic ?? 0.45,
    PHRASE:   weights?.phrase   ?? 0.25,
    SEMANTIC: weights?.semantic ?? 0.25,
    EXCLUSION: weights?.exclusion ?? 0.20,
  };

  const fusedRaw = {};
  CATEGORIZATION_RULES.CATEGORY_LIST.forEach(cat => {
    const h = heuristic?.scores?.[cat] || 0;
    const p = phrase?.[cat] || 0;
    const s = semantic?.[cat] || 0;
    const e = exclusion?.[cat] || 0;

    // combine: heuristic/phrase are counts (small ints), semantic is cosine [-1..1], exclusion is penalty/boost
    // scale semantic to same range by multiplying by a factor (since it's usually <= 1)
    const semanticScaled = s * 5; // 5 is a chosen scale so cosine ~0.6 => 3.0 which is comparable to phrase signals
    fusedRaw[cat] = (W.HEURISTIC * h) + (W.PHRASE * p) + (W.SEMANTIC * semanticScaled) + (W.EXCLUSION * e);
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
  if (!embedding) {
    try {
      embedding = await generateEmbedding(combinedText);
    } catch (err) {
      embedding = null;
    }
  }

  // 4) Semantic similarity (L5)
  const semantic = await semanticSimilarity(embedding);

  // 5) Exclusion rules (L4)
  const exclusion = applyExclusionRules(combinedText);

  // 6) Merge with tunable weights
  const merged = mergeScores({
    heuristic,
    phrase,
    semantic,
    exclusion,
    weights: options.weights || undefined,
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
    debug: {
      weights: options.weights || { heuristic: 0.2, phrase: 0.2, semantic: 0.45, exclusion: 0.15 },
      fusedRaw: merged.fusedRaw
    }
  };
}

export default { classifyEmailFull };