// backend/utils/classify.js
import Category from "../models/Category.js";
import { CATEGORIZATION_RULES } from "../classification/categorizationRules.js"; // assumes this file exists

// --- utility helpers ---
function normalizeText(t = "") {
  return (t || "").toString().toLowerCase();
}

function cosineSim(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// --- scoring helpers using CATEGORIZATION_RULES ---
function scoreKeywordsL1(text) {
  const scores = {};
  const lower = normalizeText(text);
  for (const cat of CATEGORIZATION_RULES.CATEGORY_LIST) scores[cat] = 0;

  const rules = CATEGORIZATION_RULES.KEYWORD_RULES_L1 || {};
  for (const [cat, tokens] of Object.entries(rules)) {
    for (const tok of tokens) {
      if (!tok) continue;
      if (lower.includes(tok.toLowerCase())) scores[cat] += 1;
    }
  }
  return scores;
}

function scorePhrasesL2(text) {
  const scores = {};
  const lower = normalizeText(text);
  for (const cat of CATEGORIZATION_RULES.CATEGORY_LIST) scores[cat] = 0;
  const rules = CATEGORIZATION_RULES.KEYWORD_RULES_L2_PHRASES || {};
  for (const [cat, phrases] of Object.entries(rules)) {
    for (const phrase of phrases) {
      if (!phrase) continue;
      if (lower.includes(phrase.toLowerCase())) scores[cat] += 1;
    }
  }
  return scores;
}

function scoreSenderDomain(from) {
  const scores = {};
  const lower = normalizeText(from || "");
  for (const cat of CATEGORIZATION_RULES.CATEGORY_LIST) scores[cat] = 0;
  const rules = CATEGORIZATION_RULES.SENDER_RULES || {};
  for (const [cat, domains] of Object.entries(rules)) {
    for (const d of domains) {
      if (!d) continue;
      if (lower.includes(d.toLowerCase())) scores[categoryKey(cat)] = (scores[categoryKey(cat)] || 0) + 2;
    }
  }
  return scores;
}

function categoryKey(cat) {
  // ensure key exists in CATEGORIZATION_RULES list
  return CATEGORIZATION_RULES.CATEGORY_LIST.includes(cat) ? cat : 'General';
}

function scoreExclusions(text) {
  const penalties = {};
  const lower = normalizeText(text);
  for (const cat of CATEGORIZATION_RULES.CATEGORY_LIST) penalties[cat] = 0;
  const ex = CATEGORIZATION_RULES.EXCLUSION_RULES_L4 || {};
  if (ex.Promotional_Disguise) {
    for (const phrase of ex.Promotional_Disguise) {
      if (lower.includes(phrase.toLowerCase())) {
        // penalize categories that might be disguised promotions
        for (const cat of Object.keys(penalties)) penalties[cat] -= 1;
      }
    }
  }

  if (ex.Spam_Signals) {
    for (const s of ex.Spam_Signals) {
      if (lower.includes(s.toLowerCase())) {
        // strong spam penalty
        penalties.Spam = (penalties.Spam || 0) + 3;
      }
    }
  }

  if (ex.Cross_Category_Conflict) {
    for (const p of ex.Cross_Category_Conflict) {
      if (lower.includes(p.toLowerCase())) {
        // demote some categories heuristically
        penalties.Promotions = (penalties.Promotions || 0) - 1;
      }
    }
  }

  return penalties;
}

// fetch category embeddings from DB and build a map
async function loadCategoryVectors() {
  const docs = await Category.find({ embedding: { $ne: null } }).lean();
  const map = {};
  for (const d of docs) map[d.name] = d.embedding;
  return map;
}

// existing embedding-only classifier (kept for compatibility)
export async function classifyEmbedding(embedding, topK = 5) {
  if (!embedding || !Array.isArray(embedding)) return [];
  const cats = await Category.find({ embedding: { $ne: null } }).lean();
  if (!cats || cats.length === 0) return [];
  const scored = cats.map((c) => ({ name: c.name, description: c.description, score: cosineSim(embedding, c.embedding) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

// --- main fusion classifier ---
export async function classifyEmail({ subject, from, text, plainText, embedding }) {
  // text: composedBody (html cleaned + text), plainText: textBody
  const combinedText = `${subject || ""} \n ${text || ""} \n ${plainText || ""}`;

  // compute heuristic scores
  const kw = scoreKeywordsL1(combinedText);
  const ph = scorePhrasesL2(combinedText);
  const sd = scoreSenderDomain(from || "");
  const ex = scoreExclusions(combinedText);

  // accumulate base heuristic score per category
  const baseScores = {};
  for (const cat of CATEGORIZATION_RULES.CATEGORY_LIST) {
    baseScores[cat] = 0;
    baseScores[cat] += (kw[cat] || 0) * 1.0; // L1 weight factor baked in later
    baseScores[cat] += (ph[cat] || 0) * 1.5; // L2 phrases slightly stronger
    baseScores[cat] += (sd[cat] || 0) * 2.0; // sender strong
    baseScores[cat] += (ex[cat] || 0) * 1.0; // exclusions (negative or positive)
  }

  // embedding scores
  let embedMap = {};
  try {
    embedMap = await loadCategoryVectors();
  } catch (e) {
    console.warn('⚠ Could not load category vectors:', e);
  }

  const embedScores = {};
  if (embedding && Object.keys(embedMap).length > 0) {
    for (const cat of CATEGORIZATION_RULES.CATEGORY_LIST) {
      const v = embedMap[cat];
      embedScores[cat] = v ? cosineSim(embedding, v) : 0;
    }
  } else {
    for (const cat of CATEGORIZATION_RULES.CATEGORY_LIST) embedScores[cat] = 0;
  }

  // Weights (tunable)
  const W = {
    L1: 0.20, // keywords
    L2: 0.20, // phrases
    L3: 0.25, // sender
    L4: -0.20, // exclusions (applied as negative)
    EMBED: 0.55,
  };

  // compute fused score
  const fused = [];
  for (const cat of CATEGORIZATION_RULES.CATEGORY_LIST) {
    const l1 = (kw[cat] || 0);
    const l2 = (ph[cat] || 0);
    const l3 = (sd[cat] || 0);
    const l4 = (ex[cat] || 0);
    const em = (embedScores[cat] || 0);

    const score = W.L1 * l1 + W.L2 * l2 + W.L3 * l3 + W.L4 * l4 + W.EMBED * em;
    fused.push({ name: cat, score, breakdown: { l1, l2, l3, l4, em } });
  }

  fused.sort((a, b) => b.score - a.score);

  // normalise top score to 0..1 for readability
  const top = fused[0];
  let topScore = top ? top.score : 0;
  // simple normalisation by shifting and scaling
  // find min and max
  const values = fused.map((f) => f.score);
  const maxV = Math.max(...values);
  const minV = Math.min(...values);
  if (maxV === minV) {
    topScore = top ? 1.0 : 0.0;
  } else {
    topScore = (top.score - minV) / (maxV - minV);
  }

  const candidates = fused.map((f) => ({ name: f.name, score: Number(f.score.toFixed(4)), breakdown: f.breakdown }));

  return {
    top: top ? top.name : "General",
    topScore: Number(topScore.toFixed(4)),
    candidates,
    heuristic: { kw, ph, sd, ex },
  };
}