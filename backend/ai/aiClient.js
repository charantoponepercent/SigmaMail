/**
 * AI Client Wrapper — Gemini
 *
 * Responsibilities:
 * - Call Gemini
 * - Enforce JSON-only output
 * - Handle timeouts / failures gracefully
 */

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const DEFAULT_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 12000);
const FALLBACK_MODELS = (process.env.GEMINI_FALLBACK_MODELS || "gemini-2.5-flash")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);
const MAX_RETRIES = Math.max(0, Number(process.env.GEMINI_MAX_RETRIES || 1));

function normalizeGeminiError(err) {
  if (!err) return "Unknown AI error";

  if (err.name === "AbortError" || err?.message?.includes("aborted")) {
    return "Gemini request timed out";
  }

  const msg = typeof err.message === "string" ? err.message : "";
  if (msg.includes("API_KEY_INVALID") || msg.includes("API key not valid")) {
    return "Gemini API key is invalid";
  }
  if (msg.includes("PERMISSION_DENIED")) {
    return "Gemini access denied for this model";
  }
  if (/quota exceeded|rate limit/i.test(msg)) {
    return "Gemini quota exceeded";
  }
  if (msg.includes("NOT_FOUND") || msg.includes("404")) {
    return "Gemini model not found";
  }
  if (msg.includes("Error fetching from https://generativelanguage.googleapis.com")) {
    return "Gemini network request failed";
  }

  if (typeof err.message === "string") {
    return err.message;
  }

  return "Gemini failed with unknown error";
}

function isFatalGeminiError(message = "") {
  const text = (message || "").toLowerCase();
  return (
    text.includes("api key is invalid") ||
    text.includes("api_key_invalid") ||
    text.includes("access denied")
  );
}

function isRetryableGeminiError(message = "") {
  const text = (message || "").toLowerCase();
  return (
    text.includes("timed out") ||
    text.includes("network") ||
    text.includes("fetch") ||
    text.includes("503") ||
    text.includes("429")
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildCandidateModels(model) {
  const out = [];
  const seen = new Set();
  [model, DEFAULT_MODEL, ...FALLBACK_MODELS].forEach((m) => {
    if (!m || seen.has(m)) return;
    seen.add(m);
    out.push(m);
  });
  return out;
}

function cleanModelName(modelName = "") {
  if (!modelName) return DEFAULT_MODEL;
  return modelName.startsWith("models/") ? modelName.slice("models/".length) : modelName;
}

function extractJson(raw = "") {
  const text = String(raw || "").trim();
  if (!text) {
    throw new Error("Empty Gemini response");
  }

  // Handle fenced output if the model ignores JSON-only instruction.
  const unfenced = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    return JSON.parse(unfenced);
  } catch {
    // Continue with brace extraction fallback below.
  }

  const objectStart = unfenced.indexOf("{");
  const arrayStart = unfenced.indexOf("[");
  const start =
    objectStart === -1
      ? arrayStart
      : arrayStart === -1
        ? objectStart
        : Math.min(objectStart, arrayStart);
  const objectEnd = unfenced.lastIndexOf("}");
  const arrayEnd = unfenced.lastIndexOf("]");
  const end = Math.max(objectEnd, arrayEnd);

  if (start !== -1 && end !== -1 && end > start) {
    const slice = unfenced.slice(start, end + 1);
    return JSON.parse(slice);
  }

  throw new Error("Gemini returned non-JSON output");
}

async function requestGeminiViaRest({ apiKey, modelName, prompt, signal }) {
  const cleanModel = cleanModelName(modelName);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cleanModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    signal,
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
      },
    }),
  });

  const rawBody = await res.text();
  let parsed;
  try {
    parsed = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    const apiMessage =
      parsed?.error?.message ||
      (typeof rawBody === "string" ? rawBody.slice(0, 240) : `status ${res.status}`);
    throw new Error(apiMessage);
  }

  const parts = parsed?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts)
    ? parts
        .map((p) => (typeof p?.text === "string" ? p.text : ""))
        .join("")
        .trim()
    : "";

  if (!text) {
    const blockReason = parsed?.promptFeedback?.blockReason;
    if (blockReason) {
      throw new Error(`Gemini blocked response: ${blockReason}`);
    }
    throw new Error("Empty Gemini response");
  }

  return text;
}

/**
 * Call Gemini with a system prompt and user payload.
 * Must return parsed JSON.
 */
export async function callAI({
  systemPrompt,
  userPayload,
  model = DEFAULT_MODEL,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  if (!systemPrompt || !userPayload) {
    throw new Error("callAI requires systemPrompt and userPayload");
  }
  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("Gemini API key missing");
  }

  const prompt = `
SYSTEM:
${systemPrompt}

USER_INPUT_JSON:
${JSON.stringify(userPayload)}

IMPORTANT:
- Respond with VALID JSON ONLY
- Do NOT include markdown
- Do NOT include explanations outside JSON
`;

  const models = buildCandidateModels(model);
  let lastError = "unknown_error";

  for (const modelName of models) {
    let attempt = 0;
    const maxAttemptsForModel = 1 + MAX_RETRIES;

    while (attempt < maxAttemptsForModel) {
      attempt += 1;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const raw = await requestGeminiViaRest({
          apiKey,
          modelName,
          prompt,
          signal: controller.signal,
        });
        const parsed = extractJson(raw);
        return parsed;
      } catch (err) {
        const normalized = normalizeGeminiError(err);
        lastError = normalized;
        const fatal = isFatalGeminiError(normalized);
        const retryable = isRetryableGeminiError(normalized);
        if (fatal) break;
        if (attempt >= maxAttemptsForModel || !retryable) break;
        await sleep(200 * attempt);
      } finally {
        clearTimeout(timeout);
      }
    }

    if (isFatalGeminiError(lastError)) {
      break;
    }
  }

  throw new Error(lastError);
}
