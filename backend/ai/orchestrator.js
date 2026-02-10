import { callAI } from "./aiClient.js";
import { TODAYS_DECISION_PROMPT } from "./prompts/todaysDecision.prompt.js";

const DEFAULT_MODEL =
  process.env.AI_ORCH_MODEL ||
  process.env.GEMINI_MODEL ||
  "gemini-2.5-flash";

const TASKS = {
  summary_intent: {
    model: DEFAULT_MODEL,
    timeoutMs: Number(process.env.AI_ORCH_TIMEOUT_SUMMARY_INTENT_MS || 6500),
  },
  thread_summary: {
    model: DEFAULT_MODEL,
    timeoutMs: Number(process.env.AI_ORCH_TIMEOUT_THREAD_SUMMARY_MS || 20000),
    cacheTtlSec: Number(process.env.AI_ORCH_THREAD_SUMMARY_TTL_SEC || 300),
  },
  daily_digest: {
    model: DEFAULT_MODEL,
    timeoutMs: Number(process.env.AI_ORCH_TIMEOUT_DAILY_DIGEST_MS || 25000),
    cacheTtlSec: Number(process.env.AI_ORCH_DAILY_DIGEST_TTL_SEC || 300),
    staleCacheTtlSec: Number(process.env.AI_ORCH_DAILY_DIGEST_STALE_TTL_SEC || 86400),
    degradedCacheTtlSec: Number(process.env.AI_ORCH_DAILY_DIGEST_DEGRADED_TTL_SEC || 90),
  },
  action_decision: {
    model: DEFAULT_MODEL,
    timeoutMs: Number(process.env.AI_ORCH_TIMEOUT_ACTION_DECISION_MS || 12000),
  },
};

const SUMMARY_INTENT_PROMPT = `
You are an intent classifier for an email assistant.

Task:
- Decide if user message asks for an email summary/explanation/context.
- Be permissive if message is vague but likely asks for understanding.

Return STRICT JSON:
{
  "summarize": boolean,
  "confidence": number
}
`;

const THREAD_SUMMARY_PROMPT = `
You summarize an email thread.

Return STRICT JSON only:
{
  "summary": "Markdown summary"
}

Rules:
- concise, professional
- include key people, decisions, dates, asks
- no markdown code fences
`;

const DAILY_DIGEST_PROMPT = `
You generate a smart daily digest from structured email data.

Return STRICT JSON with exact keys:
{
  "summary": "string",
  "highlights": ["string"],
  "actions": [{"text":"string","emailId":"string","due":"optional string"}],
  "topSenders": [{"sender":"string","count":1}],
  "sections": {
    "bills": [],
    "meetings": [],
    "travel": [],
    "attachments": [],
    "priorityUnread": []
  }
}

Rules:
- include concrete details
- do not invent facts
- if section empty, return empty list
- no markdown code fences
`;

function clamp(v, min, max) {
  if (typeof v !== "number" || Number.isNaN(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function extractConfidence(v, fallback = 0.5) {
  if (typeof v !== "number" || Number.isNaN(v)) return fallback;
  return clamp(v, 0, 1);
}

function toBool(v, fallback = false) {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
  }
  return fallback;
}

function stripHtml(input = "") {
  return (input || "").replace(/<[^>]*>?/gm, " ");
}

function summaryIntentHeuristic(message = "") {
  const low = (message || "").toLowerCase();
  const positive = [
    "summarize",
    "summary",
    "tldr",
    "tl;dr",
    "what is this",
    "what's this",
    "what is this email",
    "explain",
    "brief",
    "context",
    "key points",
    "important points",
    "what does this mean",
    "clarify",
  ];
  const negative = [
    "reply to this",
    "draft a reply",
    "unsubscribe",
    "delete this",
    "archive this",
    "mark as read",
  ];

  if (positive.some((w) => low.includes(w))) {
    return { summarize: true, confidence: 0.95, reason: "keyword_positive" };
  }

  if (negative.some((w) => low.includes(w))) {
    return { summarize: false, confidence: 0.88, reason: "keyword_negative" };
  }

  return null;
}

function fallbackSummary(messages = []) {
  const latest = messages[messages.length - 1] || {};
  const sender = latest.from || "Unknown sender";
  const subject = latest.subject || "No subject";
  const body = stripHtml(latest.textBody || latest.body || "").trim().slice(0, 300);

  return `**${subject}** from **${sender}**.\n\n${body || "No clear body content available."}`;
}

function fallbackDigest(payload = {}) {
  const meta = payload.meta || {};
  const counts = meta.counts || {};
  const summary = `Processed ${meta.totalEmails || 0} emails in the last 24 hours. Detected ${counts.meetings || 0} meetings, ${counts.bills || 0} bills, and ${counts.actions || 0} action items.`;

  return {
    summary,
    highlights: [
      `${counts.meetings || 0} meetings detected`,
      `${counts.bills || 0} billing-related emails`,
      `${counts.actions || 0} action-oriented emails`,
    ],
    actions: (payload.examples?.actions || []).slice(0, 5).map((a) => ({
      text: a.subject || a.snippet || "Follow up required",
      emailId: String(a.emailId || ""),
      due: a.possibleDates?.[0] || undefined,
    })),
    topSenders: Array.isArray(meta.topSenders) ? meta.topSenders : [],
    sections: {
      bills: payload.examples?.bills || [],
      meetings: payload.examples?.meetings || [],
      travel: payload.examples?.travels || [],
      attachments: payload.examples?.attachments || [],
      priorityUnread: payload.examples?.priorityUnread || [],
    },
  };
}

function fallbackActionFromHeuristics(heuristics = {}) {
  let explanation = "This email does not appear to require action.";
  if (heuristics.isOverdueFollowUp) {
    explanation = "You are waiting for a response on an earlier conversation.";
  } else if (heuristics.hasDeadline) {
    explanation = "This email contains a deadline-like signal requiring attention.";
  } else if (heuristics.needsReply) {
    explanation = "This email likely needs your reply based on request/question signals.";
  }

  return {
    aiNeedsReply: !!heuristics.needsReply,
    aiHasDeadline: !!heuristics.hasDeadline,
    aiIsOverdueFollowUp: !!heuristics.isOverdueFollowUp,
    aiConfidence: heuristics.needsReply || heuristics.hasDeadline || heuristics.isOverdueFollowUp ? 0.62 : 0.52,
    aiExplanation: explanation,
  };
}

function buildMeta({ task, strategy, startedAt, confidence = null, cached = false, model = null, error = null }) {
  return {
    task,
    strategy,
    cached,
    model,
    confidence,
    durationMs: Date.now() - startedAt,
    error: error || null,
  };
}

export async function orchestrateSummaryIntent({ message }) {
  const startedAt = Date.now();
  const heuristic = summaryIntentHeuristic(message);

  if (heuristic && heuristic.confidence >= 0.93) {
    return {
      summarize: heuristic.summarize,
      _meta: buildMeta({
        task: "summary_intent",
        strategy: "heuristic_short_circuit",
        startedAt,
        confidence: heuristic.confidence,
      }),
    };
  }

  try {
    const ai = await callAI({
      systemPrompt: SUMMARY_INTENT_PROMPT,
      userPayload: { message },
      model: TASKS.summary_intent.model,
      timeoutMs: TASKS.summary_intent.timeoutMs,
    });

    const summarize = toBool(ai?.summarize, heuristic?.summarize ?? false);
    const confidence = extractConfidence(ai?.confidence, heuristic?.confidence ?? 0.68);

    return {
      summarize,
      _meta: buildMeta({
        task: "summary_intent",
        strategy: "llm",
        startedAt,
        confidence,
        model: TASKS.summary_intent.model,
      }),
    };
  } catch (err) {
    const fallback = heuristic || { summarize: false, confidence: 0.4 };
    return {
      summarize: fallback.summarize,
      _meta: buildMeta({
        task: "summary_intent",
        strategy: "fallback",
        startedAt,
        confidence: fallback.confidence,
        error: err?.message || "unknown_error",
      }),
    };
  }
}

export async function orchestrateThreadSummary({ threadId, messages, redisClient = null }) {
  const startedAt = Date.now();
  const cacheKey = `ai:thread-summary:v1:${threadId}`;

  if (redisClient) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        return {
          ...parsed,
          _meta: buildMeta({
            task: "thread_summary",
            strategy: "cache_hit",
            startedAt,
            cached: true,
            confidence: 0.99,
          }),
        };
      }
    } catch (err) {
      // ignore cache failures
    }
  }

  const payload = {
    threadId,
    messages: (messages || []).map((m) => ({
      from: m.from || "",
      date: m.date || null,
      subject: m.subject || "",
      text: stripHtml(m.textBody || m.body || "").slice(0, 1600),
    })),
  };

  try {
    const ai = await callAI({
      systemPrompt: THREAD_SUMMARY_PROMPT,
      userPayload: payload,
      model: TASKS.thread_summary.model,
      timeoutMs: TASKS.thread_summary.timeoutMs,
    });

    const summaryText = typeof ai?.summary === "string" && ai.summary.trim()
      ? ai.summary.trim()
      : fallbackSummary(messages);

    const output = { summary: summaryText };

    if (redisClient) {
      try {
        await redisClient.set(cacheKey, JSON.stringify(output), "EX", TASKS.thread_summary.cacheTtlSec);
      } catch (err) {
        // ignore cache failures
      }
    }

    return {
      ...output,
      _meta: buildMeta({
        task: "thread_summary",
        strategy: "llm",
        startedAt,
        confidence: 0.85,
        model: TASKS.thread_summary.model,
      }),
    };
  } catch (err) {
    return {
      summary: fallbackSummary(messages),
      _meta: buildMeta({
        task: "thread_summary",
        strategy: "fallback",
        startedAt,
        confidence: 0.55,
        error: err?.message || "unknown_error",
      }),
    };
  }
}

function normalizeDigestResult(ai, payload) {
  const fallback = fallbackDigest(payload);

  if (!ai || typeof ai !== "object") return fallback;

  return {
    summary: typeof ai.summary === "string" && ai.summary.trim() ? ai.summary.trim() : fallback.summary,
    highlights: Array.isArray(ai.highlights) ? ai.highlights.slice(0, 10) : fallback.highlights,
    actions: Array.isArray(ai.actions) ? ai.actions.slice(0, 12) : fallback.actions,
    topSenders: Array.isArray(ai.topSenders) ? ai.topSenders.slice(0, 10) : fallback.topSenders,
    sections: {
      bills: Array.isArray(ai?.sections?.bills) ? ai.sections.bills : fallback.sections.bills,
      meetings: Array.isArray(ai?.sections?.meetings) ? ai.sections.meetings : fallback.sections.meetings,
      travel: Array.isArray(ai?.sections?.travel) ? ai.sections.travel : fallback.sections.travel,
      attachments: Array.isArray(ai?.sections?.attachments) ? ai.sections.attachments : fallback.sections.attachments,
      priorityUnread: Array.isArray(ai?.sections?.priorityUnread) ? ai.sections.priorityUnread : fallback.sections.priorityUnread,
    },
  };
}

function normalizeCachedDigestEnvelope(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    if (parsed.result && typeof parsed.result === "object") {
      return {
        result: parsed.result,
        model: parsed.model || null,
      };
    }

    // Backward-compat: allow directly cached digest body.
    return {
      result: parsed,
      model: null,
    };
  } catch {
    return null;
  }
}

export async function orchestrateDailyDigest({
  payload,
  redisClient = null,
  cacheKey = null,
}) {
  const startedAt = Date.now();
  const staleCacheKey = cacheKey ? `${cacheKey}:stale` : null;

  if (redisClient && cacheKey) {
    try {
      const raw = await redisClient.get(cacheKey);
      const cached = normalizeCachedDigestEnvelope(raw);
      if (cached?.result) {
        return {
          ...cached.result,
          _meta: buildMeta({
            task: "daily_digest",
            strategy: "cache_hit",
            startedAt,
            confidence: 0.99,
            cached: true,
            model: cached.model || TASKS.daily_digest.model,
          }),
        };
      }
    } catch {
      // ignore cache read failures
    }
  }

  try {
    const ai = await callAI({
      systemPrompt: DAILY_DIGEST_PROMPT,
      userPayload: payload,
      model: TASKS.daily_digest.model,
      timeoutMs: TASKS.daily_digest.timeoutMs,
    });

    const normalized = normalizeDigestResult(ai, payload);

    if (redisClient && cacheKey) {
      const envelope = JSON.stringify({
        result: normalized,
        model: TASKS.daily_digest.model,
      });
      try {
        await redisClient.set(cacheKey, envelope, "EX", TASKS.daily_digest.cacheTtlSec);
        if (staleCacheKey) {
          await redisClient.set(staleCacheKey, envelope, "EX", TASKS.daily_digest.staleCacheTtlSec);
        }
      } catch {
        // ignore cache write failures
      }
    }

    return {
      ...normalized,
      _meta: buildMeta({
        task: "daily_digest",
        strategy: "llm",
        startedAt,
        confidence: 0.82,
        model: TASKS.daily_digest.model,
      }),
    };
  } catch (err) {
    if (redisClient && staleCacheKey) {
      try {
        const rawStale = await redisClient.get(staleCacheKey);
        const stale = normalizeCachedDigestEnvelope(rawStale);
        if (stale?.result) {
          return {
            ...stale.result,
            _meta: buildMeta({
              task: "daily_digest",
              strategy: "cache_stale_recovery",
              startedAt,
              confidence: 0.7,
              cached: true,
              model: stale.model || TASKS.daily_digest.model,
            }),
          };
        }
      } catch {
        // ignore stale cache read failures
      }
    }

    const degraded = fallbackDigest(payload);
    if (redisClient && cacheKey) {
      try {
        const envelope = JSON.stringify({
          result: degraded,
          model: "local-route",
        });
        await redisClient.set(cacheKey, envelope, "EX", TASKS.daily_digest.degradedCacheTtlSec);
      } catch {
        // ignore degraded cache write failures
      }
    }

    return {
      ...degraded,
      _meta: buildMeta({
        task: "daily_digest",
        strategy: "fallback",
        startedAt,
        confidence: 0.5,
        error: err?.message || "unknown_error",
      }),
    };
  }
}

export async function orchestrateActionDecision({ email, heuristics }) {
  const startedAt = Date.now();
  const shouldRunAI =
    heuristics?.needsReply ||
    heuristics?.hasDeadline ||
    heuristics?.isOverdueFollowUp ||
    (heuristics?.needsReplyScore > 0.3 && heuristics?.needsReplyScore < 0.7);

  if (!shouldRunAI) {
    return {
      ...fallbackActionFromHeuristics(heuristics),
      _meta: buildMeta({
        task: "action_decision",
        strategy: "heuristic_short_circuit",
        startedAt,
        confidence: 0.6,
      }),
    };
  }

  try {
    const ai = await callAI({
      systemPrompt: TODAYS_DECISION_PROMPT,
      userPayload: {
        email: {
          subject: email?.subject || "",
          text: email?.text || email?.textBody || email?.snippet || "",
          from: email?.from || "",
          to: email?.to || "",
          date: email?.date || null,
        },
        heuristics,
      },
      model: TASKS.action_decision.model,
      timeoutMs: TASKS.action_decision.timeoutMs,
    });

    const out = {
      aiNeedsReply: toBool(ai?.aiNeedsReply, !!heuristics?.needsReply),
      aiHasDeadline: toBool(ai?.aiHasDeadline, !!heuristics?.hasDeadline),
      aiIsOverdueFollowUp: toBool(ai?.aiIsOverdueFollowUp, !!heuristics?.isOverdueFollowUp),
      aiConfidence: extractConfidence(ai?.aiConfidence, 0.66),
      aiExplanation: typeof ai?.aiExplanation === "string" && ai.aiExplanation.trim()
        ? ai.aiExplanation.trim()
        : fallbackActionFromHeuristics(heuristics).aiExplanation,
    };

    return {
      ...out,
      _meta: buildMeta({
        task: "action_decision",
        strategy: "llm",
        startedAt,
        confidence: out.aiConfidence,
        model: TASKS.action_decision.model,
      }),
    };
  } catch (err) {
    const fallback = fallbackActionFromHeuristics(heuristics);
    return {
      ...fallback,
      _meta: buildMeta({
        task: "action_decision",
        strategy: "fallback",
        startedAt,
        confidence: fallback.aiConfidence,
        error: err?.message || "unknown_error",
      }),
    };
  }
}

export default {
  orchestrateSummaryIntent,
  orchestrateThreadSummary,
  orchestrateDailyDigest,
  orchestrateActionDecision,
};
