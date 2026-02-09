// backend/classification/categoryCache.js
import Category from "../models/Category.js";
import { SEMANTIC_OPTIONS } from "./config.js";

let cachedCategories = [];
let cacheExpiresAt = 0;

export async function getCategoryEmbeddings(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedCategories.length > 0 && now < cacheExpiresAt) {
    return cachedCategories;
  }

  const connectionReady = Category?.db?.readyState === 1;
  if (!connectionReady) {
    console.warn("Category cache skipped: MongoDB connection not ready.");
    cacheExpiresAt = now + 5 * 1000;
    return [];
  }

  try {
    const docs = await Category.find({ enabled: { $ne: false } }).lean();
    cachedCategories = (docs || []).filter(doc => Array.isArray(doc.embedding) && doc.embedding.length >= SEMANTIC_OPTIONS.minVectorSize);
    cacheExpiresAt = now + SEMANTIC_OPTIONS.cacheTtlMs;
  } catch (err) {
    console.warn("Failed to refresh category embeddings:", err.message);
    if (cachedCategories.length === 0) {
      cacheExpiresAt = now + 5 * 1000; // short retry window
    }
  }
  return cachedCategories;
}

export function clearCategoryCache() {
  cachedCategories = [];
  cacheExpiresAt = 0;
}

export default { getCategoryEmbeddings, clearCategoryCache };
