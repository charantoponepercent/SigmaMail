import CategorizationRule from "../models/CategorizationRule.js";
import Email from "../models/Email.js";
import { CATEGORIZATION_RULES } from "./categorizationRules.js";

const STOP_WORDS = new Set([
  "a","an","and","are","as","at","be","but","by","for","from","has","have","if","in","into","is","it","its","just",
  "me","my","new","no","not","of","on","or","our","out","so","that","the","their","there","these","this","to","up",
  "was","we","were","will","with","you","your","re","fw","fwd","regards","thanks","hello","dear","team","please",
  "can","could","would","should","about","after","before","more","now","today","tomorrow","yesterday","update","mail",
]);

function normalizeText(t = "") {
  return (t || "").toString().toLowerCase();
}

function escapeRegex(text = "") {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractEmailAddress(from = "") {
  const text = normalizeText(from);
  const angle = text.match(/<([^>]+)>/);
  if (angle?.[1]) return angle[1].trim();
  const plain = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/);
  return plain?.[0] || "";
}

function extractDomain(email = "") {
  const idx = email.indexOf("@");
  return idx >= 0 ? email.slice(idx + 1) : "";
}

function extractKeywords(input = "", maxTokens = 12) {
  const counts = new Map();
  const clean = normalizeText(input).replace(/[^a-z0-9\s]/g, " ");
  const tokens = clean
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4 && !STOP_WORDS.has(t) && !/^\d+$/.test(t));

  for (const token of tokens) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxTokens)
    .map(([token]) => token);
}

export async function recordCategorizationFeedback({ userId, email, correctedCategory }) {
  if (!userId || !email || !correctedCategory) return null;
  if (!CATEGORIZATION_RULES.CATEGORY_LIST.includes(correctedCategory)) {
    throw new Error(`Invalid category: ${correctedCategory}`);
  }

  const senderEmail = extractEmailAddress(email.from || "");
  const senderDomain = extractDomain(senderEmail);
  if (!senderDomain) return null;

  const textBlob = [
    email.subject || "",
    email.snippet || "",
    email.textBody || "",
    email.htmlBodyProcessed || "",
  ].join("\n");
  const keywords = extractKeywords(textBlob);

  const existing = await CategorizationRule.findOne({
    userId,
    category: correctedCategory,
    senderDomain,
  });

  if (!existing) {
    const keywordWeights = {};
    for (const kw of keywords) keywordWeights[kw] = 1;
    return CategorizationRule.create({
      userId,
      category: correctedCategory,
      senderDomain,
      senderEmails: senderEmail ? [senderEmail] : [],
      keywordWeights,
      feedbackCount: 1,
      lastFeedbackAt: new Date(),
    });
  }

  const senderSet = new Set(existing.senderEmails || []);
  if (senderEmail) senderSet.add(senderEmail);
  existing.senderEmails = [...senderSet].slice(0, 100);

  const map = existing.keywordWeights instanceof Map
    ? existing.keywordWeights
    : new Map(Object.entries(existing.keywordWeights || {}));
  for (const kw of keywords) {
    const current = Number(map.get(kw) || 0);
    map.set(kw, Math.min(current + 1, 10));
  }
  existing.keywordWeights = map;
  existing.feedbackCount = (existing.feedbackCount || 0) + 1;
  existing.lastFeedbackAt = new Date();

  await existing.save();
  return existing;
}

export async function computeFeedbackScoresForEmail({ userId, email }) {
  const scores = {};
  CATEGORIZATION_RULES.CATEGORY_LIST.forEach((cat) => (scores[cat] = 0));
  if (!userId || !email) return scores;

  const senderEmail = extractEmailAddress(email.from || "");
  const senderDomain = extractDomain(senderEmail);
  if (!senderDomain) return scores;

  const rules = await CategorizationRule.find({ userId, senderDomain }).lean();
  if (!rules.length) return scores;

  const combinedText = normalizeText(
    `${email.subject || ""}\n${email.snippet || ""}\n${email.text || ""}\n${email.plainText || ""}`
  );

  for (const rule of rules) {
    const cat = rule.category;
    if (!scores.hasOwnProperty(cat)) continue;

    let boost = 0;
    if (senderEmail && Array.isArray(rule.senderEmails) && rule.senderEmails.includes(senderEmail)) {
      boost += 3;
    }
    boost += 2; // same sender domain already matched

    const keywordEntries = Object.entries(rule.keywordWeights || {});
    let keywordBoost = 0;
    for (const [kw, weightRaw] of keywordEntries) {
      if (!kw) continue;
      if (!combinedText.includes(kw)) continue;
      const weight = Number(weightRaw || 0);
      keywordBoost += Math.min(0.35 * Math.max(weight, 1), 1.4);
    }

    boost += Math.min(keywordBoost, 4);
    scores[cat] += boost;
  }

  return scores;
}

export async function propagateCategoryToRelatedEmails({
  userId,
  seedEmail,
  correctedCategory,
  maxCandidates = 500,
  maxUpdates = 200,
}) {
  if (!userId || !seedEmail || !correctedCategory) {
    return { updatedCount: 0, scannedCount: 0, relatedEmailIds: [] };
  }

  const seedSenderEmail = extractEmailAddress(seedEmail.from || "");
  const seedSenderDomain = extractDomain(seedSenderEmail);
  const seedKeywords = extractKeywords(
    [
      seedEmail.subject || "",
      seedEmail.snippet || "",
      seedEmail.textBody || "",
      seedEmail.htmlBodyProcessed || "",
    ].join("\n"),
    14
  );
  const seedKeywordSet = new Set(seedKeywords);
  const seedSubjectNorm = normalizeText(seedEmail.subject || "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const orClauses = [];
  if (seedEmail.threadId) orClauses.push({ threadId: seedEmail.threadId });
  if (seedSenderEmail) {
    orClauses.push({
      from: { $regex: escapeRegex(seedSenderEmail), $options: "i" },
    });
  }
  if (seedSenderDomain) {
    orClauses.push({
      from: { $regex: `@${escapeRegex(seedSenderDomain)}\\b`, $options: "i" },
    });
  }
  for (const kw of seedKeywords.slice(0, 6)) {
    const re = `\\b${escapeRegex(kw)}\\b`;
    orClauses.push({ subject: { $regex: re, $options: "i" } });
    orClauses.push({ snippet: { $regex: re, $options: "i" } });
  }

  if (orClauses.length === 0) {
    return { updatedCount: 0, scannedCount: 0, relatedEmailIds: [] };
  }

  const candidates = await Email.find({
    userId,
    _id: { $ne: seedEmail._id },
    $or: orClauses,
  })
    .select("_id threadId from subject snippet textBody category")
    .sort({ date: -1 })
    .limit(Math.max(50, maxCandidates))
    .lean();

  const relatedIds = [];

  for (const candidate of candidates) {
    if (!candidate?._id) continue;
    const candidateSenderEmail = extractEmailAddress(candidate.from || "");
    const candidateDomain = extractDomain(candidateSenderEmail);
    const candidateSubjectNorm = normalizeText(candidate.subject || "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const candidateKeywords = extractKeywords(
      [candidate.subject || "", candidate.snippet || "", candidate.textBody || ""].join("\n"),
      18
    );
    const overlap = candidateKeywords.filter((kw) => seedKeywordSet.has(kw)).length;

    let include = false;
    let score = 0;

    if (seedEmail.threadId && candidate.threadId === seedEmail.threadId) {
      include = true;
    }

    if (!include && seedSenderEmail && candidateSenderEmail === seedSenderEmail) {
      include = true;
    }

    if (!include) {
      if (seedSenderDomain && candidateDomain === seedSenderDomain) score += 3;
      if (overlap > 0) score += Math.min(4, overlap * 1.2);
      if (
        seedSubjectNorm &&
        candidateSubjectNorm &&
        (candidateSubjectNorm.includes(seedSubjectNorm) || seedSubjectNorm.includes(candidateSubjectNorm))
      ) {
        score += 2;
      }

      include =
        score >= 6 ||
        (seedSenderDomain && candidateDomain === seedSenderDomain && overlap >= 2) ||
        overlap >= 4;
    }

    if (!include) continue;
    relatedIds.push(String(candidate._id));
    if (relatedIds.length >= maxUpdates) break;
  }

  if (relatedIds.length === 0) {
    return { updatedCount: 0, scannedCount: candidates.length, relatedEmailIds: [] };
  }

  const updateRes = await Email.updateMany(
    { userId, _id: { $in: relatedIds } },
    {
      $set: {
        category: correctedCategory,
        categoryScore: 1,
      },
    }
  );

  return {
    updatedCount: Number(updateRes.modifiedCount || 0),
    scannedCount: candidates.length,
    relatedEmailIds: relatedIds,
  };
}

export default {
  recordCategorizationFeedback,
  computeFeedbackScoresForEmail,
  propagateCategoryToRelatedEmails,
};
