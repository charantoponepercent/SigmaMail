/**
 * AI Client Wrapper — Gemini
 *
 * Responsibilities:
 * - Call Gemini
 * - Enforce JSON-only output
 * - Handle timeouts / failures gracefully
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function normalizeGeminiError(err) {
  if (!err) return "Unknown AI error";

  if (err.name === "AbortError") {
    return "Gemini request timed out";
  }

  if (typeof err.message === "string") {
    return err.message;
  }

  return "Gemini failed with unknown error";
}

/**
 * Call Gemini with a system prompt and user payload.
 * Must return parsed JSON.
 */
export async function callAI({
  systemPrompt,
  userPayload,
  model = "gemini-3-flash-preview",
  timeoutMs = 8000,
}) {
  if (!systemPrompt || !userPayload) {
    throw new Error("callAI requires systemPrompt and userPayload");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const generativeModel = genAI.getGenerativeModel({
      model,
      generationConfig: {
        temperature: 0,
      },
    });

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

    const result = await generativeModel.generateContent(prompt, {
      signal: controller.signal,
    });

    const raw = result?.response?.text?.();

    if (!raw) {
      throw new Error("Empty Gemini response");
    }

    // Defensive JSON parsing
    try {
      const firstBrace = raw.indexOf("{");
      const lastBrace = raw.lastIndexOf("}");

      if (firstBrace === -1 || lastBrace === -1) {
        return null; // ❗ Non‑JSON → treat as AI unavailable
      }

      const jsonString = raw.slice(firstBrace, lastBrace + 1);
      return JSON.parse(jsonString);
    } catch {
      return null; // ❗ Invalid JSON → treat as AI unavailable
    }
  } catch (err) {
    throw new Error(normalizeGeminiError(err));
  } finally {
    clearTimeout(timeout);
  }
}
