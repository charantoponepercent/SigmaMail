import { redis } from "../utils/redis.js";

const DEFAULT_LIMIT = 12;
const MAX_KEEP = 100;

function buildKey(userId) {
  return `ai:orchestrator:status:${userId}`;
}

function safeNum(v) {
  return typeof v === "number" && !Number.isNaN(v) ? v : null;
}

export async function recordOrchestratorStatus({ userId, meta, context = {} }) {
  if (!userId || !meta?.task || !meta?.strategy) return;

  const payload = {
    at: new Date().toISOString(),
    task: meta.task,
    strategy: meta.strategy,
    confidence: safeNum(meta.confidence),
    model: meta.model || null,
    latencyMs: safeNum(meta.durationMs),
    cached: !!meta.cached,
    error: meta.error || null,
    context,
  };

  try {
    const key = buildKey(userId);
    await redis.lpush(key, JSON.stringify(payload));
    await redis.ltrim(key, 0, MAX_KEEP - 1);
  } catch (err) {
    // Do not block primary feature on telemetry failures.
    console.warn("⚠️ Orchestrator telemetry write failed:", err?.message || err);
  }
}

export async function getOrchestratorStatus({ userId, limit = DEFAULT_LIMIT }) {
  if (!userId) return [];

  const safeLimit = Math.max(1, Math.min(Number(limit) || DEFAULT_LIMIT, 50));
  try {
    const key = buildKey(userId);
    const rows = await redis.lrange(key, 0, safeLimit - 1);
    return rows
      .map((r) => {
        try {
          return JSON.parse(r);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch (err) {
    console.warn("⚠️ Orchestrator telemetry read failed:", err?.message || err);
    return [];
  }
}

export async function clearOrchestratorStatus({ userId }) {
  if (!userId) return;
  try {
    const key = buildKey(userId);
    await redis.del(key);
  } catch (err) {
    console.warn("⚠️ Orchestrator telemetry clear failed:", err?.message || err);
  }
}

export default {
  recordOrchestratorStatus,
  getOrchestratorStatus,
  clearOrchestratorStatus,
};
