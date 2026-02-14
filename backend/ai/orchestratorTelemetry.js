import {
  getRedisClient,
  shouldUseRedisForTelemetry,
} from "../utils/redis.js";

const DEFAULT_LIMIT = 12;
const MAX_KEEP = 100;
const memoryTelemetry = new Map();

function getTelemetryRedisClient() {
  if (!shouldUseRedisForTelemetry()) return null;
  return getRedisClient({ purpose: "orchestrator telemetry" });
}

function buildKey(userId) {
  return `ai:orchestrator:status:${userId}`;
}

function safeNum(v) {
  return typeof v === "number" && !Number.isNaN(v) ? v : null;
}

function readMemory(key, limit) {
  const rows = memoryTelemetry.get(key) || [];
  return rows.slice(0, limit);
}

function writeMemory(key, payload) {
  const rows = memoryTelemetry.get(key) || [];
  rows.unshift(payload);
  if (rows.length > MAX_KEEP) {
    rows.length = MAX_KEEP;
  }
  memoryTelemetry.set(key, rows);
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
    const telemetryRedisClient = getTelemetryRedisClient();
    if (telemetryRedisClient) {
      await telemetryRedisClient.lpush(key, JSON.stringify(payload));
      await telemetryRedisClient.ltrim(key, 0, MAX_KEEP - 1);
      return;
    }
    writeMemory(key, payload);
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
    const telemetryRedisClient = getTelemetryRedisClient();
    if (telemetryRedisClient) {
      const rows = await telemetryRedisClient.lrange(key, 0, safeLimit - 1);
      return rows
        .map((r) => {
          try {
            return JSON.parse(r);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    }
    return readMemory(key, safeLimit);
  } catch (err) {
    console.warn("⚠️ Orchestrator telemetry read failed:", err?.message || err);
    return [];
  }
}

export async function clearOrchestratorStatus({ userId }) {
  if (!userId) return;
  try {
    const key = buildKey(userId);
    const telemetryRedisClient = getTelemetryRedisClient();
    if (telemetryRedisClient) {
      await telemetryRedisClient.del(key);
      return;
    }
    memoryTelemetry.delete(key);
  } catch (err) {
    console.warn("⚠️ Orchestrator telemetry clear failed:", err?.message || err);
  }
}

export default {
  recordOrchestratorStatus,
  getOrchestratorStatus,
  clearOrchestratorStatus,
};
