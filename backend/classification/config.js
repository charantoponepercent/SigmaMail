// backend/classification/config.js
export const CLASSIFICATION_WEIGHTS = {
  heuristic: Number(process.env.CLASSIFIER_W_HEURISTIC) || 0.4,
  phrase: Number(process.env.CLASSIFIER_W_PHRASE) || 0.2,
  semantic: Number(process.env.CLASSIFIER_W_SEMANTIC) || 0.25,
  structural: Number(process.env.CLASSIFIER_W_STRUCTURAL) || 0.25,
  exclusion: Number(process.env.CLASSIFIER_W_EXCLUSION) || 0.15,
};

export const STRUCTURAL_THRESHOLDS = {
  linkHeavy: Number(process.env.CLASSIFIER_STRUCT_LINKS) || 6,
  tableHeavy: Number(process.env.CLASSIFIER_STRUCT_TABLES) || 4,
  ctaHeavy: Number(process.env.CLASSIFIER_STRUCT_CTAS) || 2,
};

export const SEMANTIC_OPTIONS = {
  cacheTtlMs: Number(process.env.CLASSIFIER_SEM_CACHE_TTL) || 15 * 60 * 1000, // 15 minutes
  minVectorSize: Number(process.env.CLASSIFIER_SEM_MIN_VECTOR) || 128,
};

export const CATEGORY_PRIORS = {
  Work: 0.02,
  Finance: 0.08,
  Bills: 0.06,
  Personal: 0.05,
  Travel: 0.04,
  Promotions: 0.2,
  Subscriptions: 0.18,
  Social: 0.07,
  Shopping: 0.05,
  Priority: 0.04,
  Spam: 0.15,
  General: 0.06,
};

export const CLASSIFIER_FEATURE_FLAGS = {
  useSemantic: process.env.CLASSIFIER_USE_SEMANTIC !== "false",
  logVerbose: process.env.CLASSIFIER_VERBOSE_LOG === "true",
};

export default {
  CLASSIFICATION_WEIGHTS,
  STRUCTURAL_THRESHOLDS,
  SEMANTIC_OPTIONS,
  CATEGORY_PRIORS,
  CLASSIFIER_FEATURE_FLAGS,
};
