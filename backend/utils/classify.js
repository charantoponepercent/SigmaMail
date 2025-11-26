// utils/classify.js
import Category from "../models/Category.js";

/**
 * Cosine similarity (works for non-normalized too)
 * But we assume vectors are normalized (from Python service)
 */
export function cosineSim(a, b) {
  if (!a || !b || a.length !== b.length) return -1;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // if both normalized, dot == cosine similarity
}

/**
 * classifyEmbedding - returns sorted categories with scores
 * @param {number[]} embedding - email embedding
 * @param {number} topK - how many to return
 */
export async function classifyEmbedding(embedding, topK = 3) {
  if (!embedding || !Array.isArray(embedding)) return [];

  // fetch category vectors from DB
  const cats = await Category.find({ embedding: { $ne: null } }).lean();
  if (!cats || cats.length === 0) return [];

  const scored = cats.map((c) => {
    const score = cosineSim(embedding, c.embedding);
    return { name: c.name, description: c.description, score, id: c._id };
  });

  // sort descending
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topK);
}