import { runActionReevaluation } from "../workers/actionReevaluation.worker.js";

const DEFAULT_INTERVAL_MS = 30 * 60 * 1000;
const MIN_INTERVAL_MS = 60 * 1000;

let timer = null;
let running = false;

function parseBooleanEnv(name, defaultValue = true) {
  const value = String(process.env[name] || "").trim().toLowerCase();
  if (!value) return defaultValue;
  return ["1", "true", "yes", "on"].includes(value);
}

function parseIntervalMs() {
  const parsed = Number(process.env.ACTION_REEVAL_INTERVAL_MS || DEFAULT_INTERVAL_MS);
  if (!Number.isFinite(parsed) || parsed < MIN_INTERVAL_MS) {
    return DEFAULT_INTERVAL_MS;
  }
  return parsed;
}

async function runSafely(trigger) {
  if (running) return;
  running = true;
  try {
    const result = await runActionReevaluation();
    console.log("✅ Action re-evaluation finished", {
      trigger,
      processed: result?.processed ?? 0,
      ranAt: result?.ranAt || new Date().toISOString(),
    });
  } catch (err) {
    console.error("⚠️ Action re-evaluation run failed:", err?.message || err);
  } finally {
    running = false;
  }
}

export function scheduleActionReevaluation() {
  const enabled = parseBooleanEnv("ACTION_REEVAL_ENABLED", true);
  if (!enabled) {
    console.log("ℹ️ Action re-evaluation scheduler disabled via ACTION_REEVAL_ENABLED.");
    return null;
  }

  if (timer) return timer;

  const intervalMs = parseIntervalMs();
  void runSafely("startup");

  timer = setInterval(() => {
    void runSafely("interval");
  }, intervalMs);

  if (typeof timer.unref === "function") {
    timer.unref();
  }

  console.log("⏱️ Action re-evaluation scheduler started", {
    intervalMs,
  });

  return timer;
}

export function stopActionReevaluationScheduler() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
