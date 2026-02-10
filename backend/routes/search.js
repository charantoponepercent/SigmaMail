import express from "express";
import Email from "../models/Email.js";
import { generateEmbedding } from "../utils/embedding.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();

router.use(requireAuth);

const VALID_MODES = new Set(["hybrid", "semantic", "keyword"]);
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "to", "for", "of", "in", "on", "at",
  "is", "are", "was", "were", "be", "by", "with", "this", "that", "it",
  "as", "from", "re", "fw", "fwd", "your", "you",
]);

function clamp(value, min, max) {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function normalizeText(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/<[^>]*>/g, " ")
    .replace(/[^a-z0-9@._\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeQuery(query = "") {
  return normalizeText(query)
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t))
    .slice(0, 12);
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0) {
    return null;
  }
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < len; i += 1) {
    const av = Number(a[i]) || 0;
    const bv = Number(b[i]) || 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }

  if (normA === 0 || normB === 0) return null;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function recencyBoost(dateValue) {
  if (!dateValue) return 0;
  const ts = new Date(dateValue).getTime();
  if (!Number.isFinite(ts)) return 0;
  const ageDays = Math.max(0, (Date.now() - ts) / (1000 * 60 * 60 * 24));
  return Math.exp(-ageDays / 45);
}

function lexicalSignals({ queryNorm, tokens, email }) {
  const subject = normalizeText(email?.subject || "");
  const from = normalizeText(email?.from || "");
  const to = normalizeText(email?.to || "");
  const snippet = normalizeText(email?.snippet || "");
  const body = normalizeText(email?.textBody || email?.body || "");
  const corpus = `${subject} ${from} ${to} ${snippet} ${body}`.trim();

  const reasons = [];
  let score = 0;

  if (!corpus) {
    return { score: 0, reasons };
  }

  if (queryNorm.length >= 3 && subject.includes(queryNorm)) {
    score += 0.55;
    reasons.push("subject phrase match");
  }
  if (queryNorm.length >= 3 && from.includes(queryNorm)) {
    score += 0.45;
    reasons.push("sender phrase match");
  }
  if (queryNorm.length >= 4 && snippet.includes(queryNorm)) {
    score += 0.2;
    reasons.push("snippet phrase match");
  }

  if (queryNorm.includes("@")) {
    if (from.includes(queryNorm) || to.includes(queryNorm)) {
      score += 0.7;
      reasons.push("exact email match");
    }
  }

  if (tokens.length > 0) {
    const subjectHits = tokens.filter((t) => subject.includes(t)).length;
    const fromHits = tokens.filter((t) => from.includes(t)).length;
    const bodyHits = tokens.filter((t) => body.includes(t) || snippet.includes(t)).length;

    const subjectCoverage = subjectHits / tokens.length;
    const fromCoverage = fromHits / tokens.length;
    const bodyCoverage = bodyHits / tokens.length;

    score += subjectCoverage * 0.45;
    score += fromCoverage * 0.35;
    score += bodyCoverage * 0.3;

    if (subjectCoverage >= 0.6) reasons.push("high subject token overlap");
    if (fromCoverage >= 0.6) reasons.push("high sender token overlap");
    if (bodyCoverage >= 0.7) reasons.push("high body token overlap");
  }

  return { score: clamp(score, 0, 1.6), reasons: reasons.slice(0, 3) };
}

function round(value, digits = 4) {
  const base = 10 ** digits;
  return Math.round((Number(value) || 0) * base) / base;
}

router.post("/search", async (req, res) => {
  const startedAt = Date.now();
  try {
    const {
      query,
      mode = "hybrid",
      limit = 50,
      minScore,
      daysBack = 180,
      maxCandidates = 1800,
    } = req.body || {};

    if (!query || query.trim().length === 0) {
      return res.json({
        ok: true,
        query: "",
        results: [],
        meta: {
          modeUsed: "hybrid",
          totalCandidates: 0,
          totalResults: 0,
          latencyMs: Date.now() - startedAt,
        },
      });
    }

    const queryText = String(query).trim();
    const queryNorm = normalizeText(queryText);
    const tokens = tokenizeQuery(queryText);
    const modeRequested = VALID_MODES.has(String(mode)) ? String(mode) : "hybrid";
    const limitSafe = clamp(Number(limit) || 50, 1, 100);
    const daysBackSafe = clamp(Number(daysBack) || 180, 1, 3650);
    const maxCandidatesSafe = clamp(Number(maxCandidates) || 1800, 200, 6000);
    const since = new Date(Date.now() - daysBackSafe * 24 * 60 * 60 * 1000);

    let queryEmbedding = null;
    if (modeRequested !== "keyword") {
      queryEmbedding = await generateEmbedding(queryText);
    }

    const modeUsed =
      modeRequested !== "keyword" && !Array.isArray(queryEmbedding)
        ? "keyword"
        : modeRequested;
    const minScoreSafe = typeof minScore === "number"
      ? clamp(minScore, 0, 1)
      : modeUsed === "keyword"
        ? 0.22
        : 0.18;

    const candidates = await Email.find({
      userId: req.user.id,
      date: { $gte: since },
    })
      .select(
        "_id threadId messageId subject from to date snippet textBody body category isRead attachments accountEmail starred createdAt embedding"
      )
      .sort({ date: -1 })
      .limit(maxCandidatesSafe)
      .lean();

    const scored = [];
    for (const email of candidates) {
      const lexical = lexicalSignals({ queryNorm, tokens, email });
      const semanticRaw = modeUsed === "keyword"
        ? null
        : cosineSimilarity(email?.embedding, queryEmbedding);
      const semanticScore = semanticRaw === null ? null : clamp((semanticRaw + 1) / 2, 0, 1);
      const recencyScore = recencyBoost(email?.date || email?.createdAt);

      let finalScore = 0;
      if (modeUsed === "keyword") {
        finalScore = lexical.score * 0.86 + recencyScore * 0.14;
      } else if (modeUsed === "semantic") {
        if (semanticScore === null) {
          finalScore = lexical.score * 0.7 + recencyScore * 0.3;
        } else {
          finalScore = semanticScore * 0.78 + lexical.score * 0.17 + recencyScore * 0.05;
        }
      } else {
        if (semanticScore === null) {
          finalScore = lexical.score * 0.82 + recencyScore * 0.18;
        } else {
          finalScore = semanticScore * 0.55 + lexical.score * 0.35 + recencyScore * 0.1;
        }
      }

      const why = [...lexical.reasons];
      if (semanticScore !== null && semanticScore >= 0.72) why.push("strong semantic match");
      if (recencyScore >= 0.8) why.push("recent conversation");
      const dedupedWhy = Array.from(new Set(why)).slice(0, 3);

      if (finalScore < minScoreSafe && lexical.score < 0.35) continue;

      scored.push({
        email,
        score: finalScore,
        semanticScore: semanticScore ?? 0,
        lexicalScore: lexical.score,
        recencyScore,
        why: dedupedWhy,
      });
    }

    scored.sort((a, b) => b.score - a.score);

    const byThread = new Map();
    for (const hit of scored) {
      const key = String(hit.email?.threadId || hit.email?._id || hit.email?.messageId || "");
      if (!key) continue;
      const prev = byThread.get(key);
      if (!prev) {
        byThread.set(key, {
          ...hit,
          matchedCount: 1,
        });
        continue;
      }
      prev.matchedCount += 1;
      if (hit.score > prev.score) {
        byThread.set(key, {
          ...hit,
          matchedCount: prev.matchedCount,
        });
      }
    }

    const grouped = Array.from(byThread.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limitSafe)
      .map((hit) => {
        const attachments = Array.isArray(hit.email.attachments) ? hit.email.attachments : [];
        const email = {
          _id: hit.email?._id,
          id: hit.email?._id || hit.email?.messageId || hit.email?.threadId,
          messageId: hit.email?.messageId,
          threadId: hit.email?.threadId,
          subject: hit.email?.subject || "(No subject)",
          from: hit.email?.from || "",
          to: hit.email?.to || "",
          date: hit.email?.date || hit.email?.createdAt || null,
          snippet: hit.email?.snippet || "",
          category: hit.email?.category || "General",
          isRead: hit.email?.isRead ?? true,
          attachments,
          threadAttachmentCount: attachments.length,
          accountEmail: hit.email?.accountEmail || "",
          starred: !!hit.email?.starred,
          createdAt: hit.email?.createdAt || null,
          searchScore: round(hit.score),
          semanticScore: round(hit.semanticScore),
          lexicalScore: round(hit.lexicalScore),
          searchWhy: hit.why,
          matchedCount: hit.matchedCount,
          hidden: false,
          count: hit.matchedCount,
        };
        return {
          email,
          score: round(hit.score),
          semanticScore: round(hit.semanticScore),
          lexicalScore: round(hit.lexicalScore),
          recencyScore: round(hit.recencyScore),
          why: hit.why,
          matchedCount: hit.matchedCount,
        };
      });

    res.json({
      ok: true,
      query: queryText,
      modeRequested,
      modeUsed,
      results: grouped,
      meta: {
        tokens,
        totalCandidates: candidates.length,
        totalScored: scored.length,
        totalResults: grouped.length,
        minScore: minScoreSafe,
        latencyMs: Date.now() - startedAt,
        embeddingUsed: Array.isArray(queryEmbedding),
      },
    });
  } catch (err) {
    console.error("❌ Search error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
