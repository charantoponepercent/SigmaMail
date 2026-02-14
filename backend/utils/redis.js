import IORedis from "ioredis";
import dotenv from 'dotenv'
dotenv.config()

const rawRedisUrl = String(process.env.REDIS_URL || "").trim();

function parseBooleanEnv(name, defaultValue = false) {
  const value = String(process.env[name] || "").trim().toLowerCase();
  if (!value) return defaultValue;
  return ["1", "true", "yes", "on"].includes(value);
}

const REDIS_QUEUE_ENABLED = parseBooleanEnv("REDIS_QUEUE_ENABLED", true);
const REDIS_CACHE_ENABLED = parseBooleanEnv("REDIS_CACHE_ENABLED", false);
const REDIS_TELEMETRY_ENABLED = parseBooleanEnv("REDIS_TELEMETRY_ENABLED", false);
const REDIS_SSE_BRIDGE_ENABLED = parseBooleanEnv("REDIS_SSE_BRIDGE_ENABLED", false);

let redisClient = null;
let missingUrlWarningShown = false;

function getRedisHostLabel() {
  try {
    return new URL(rawRedisUrl).host;
  } catch {
    return "invalid-redis-url";
  }
}

function ensureRedisClient({ required = false, purpose = "general" } = {}) {
  if (redisClient) return redisClient;

  if (!rawRedisUrl) {
    const reason = `REDIS_URL is not set (required for ${purpose})`;
    if (required) {
      throw new Error(`❌ ${reason}`);
    }
    if (!missingUrlWarningShown) {
      missingUrlWarningShown = true;
      console.warn(`⚠️ ${reason}. Redis-backed features will be skipped.`);
    }
    return null;
  }

  redisClient = new IORedis(rawRedisUrl, {
    maxRetriesPerRequest: null,
  });
  console.log(`ℹ️ Redis client initialized for ${purpose}`, {
    host: getRedisHostLabel(),
  });

  redisClient.on("error", (err) => {
    console.warn("⚠️ Redis client error:", err?.message || err);
  });

  return redisClient;
}

export function getRedisClient(options = {}) {
  return ensureRedisClient(options);
}

export function isRedisConfigured() {
  return !!rawRedisUrl;
}

export function getConfiguredRedisHost() {
  if (!rawRedisUrl) return "not-configured";
  return getRedisHostLabel();
}

export function shouldUseRedisForQueues() {
  return REDIS_QUEUE_ENABLED && isRedisConfigured();
}

export function shouldUseRedisForCache() {
  return REDIS_CACHE_ENABLED && isRedisConfigured();
}

export function shouldUseRedisForTelemetry() {
  return REDIS_TELEMETRY_ENABLED && isRedisConfigured();
}

export function shouldUseRedisForSseBridge() {
  return REDIS_SSE_BRIDGE_ENABLED && isRedisConfigured();
}

export function getRedisStatus() {
  if (!redisClient) return "not-initialized";
  return redisClient.status || "unknown";
}

export function isRedisLimitExceededError(error) {
  const msg = String(error?.message || error || "").toLowerCase();
  return (
    msg.includes("max requests limit exceeded") ||
    msg.includes("requests limit exceeded")
  );
}

export async function closeRedis() {
  if (!redisClient) return;
  try {
    await redisClient.quit();
  } finally {
    redisClient = null;
  }
}
