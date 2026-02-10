import "dotenv/config";
import "../config/db.js";
import Email from "../models/Email.js";
import EmailAccount from "../models/EmailAccount.js";
import { evaluateActions } from "../actions/index.js";

console.log("🚀 ActionReevaluation.worker loaded");

const ACTION_LOOKBACK_DAYS = Number(process.env.ACTION_REEVAL_LOOKBACK_DAYS || 21);
const STALE_HOURS = Number(process.env.ACTION_REEVAL_STALE_HOURS || 6);
const accountEmailCache = new Map();

function buildEvalMessage(email) {
  return {
    ...email,
    id: email._id?.toString?.() || email.messageId,
    text: email.textBody || email.snippet || "",
    subject: email.subject || "",
  };
}

function extractEmail(value = "") {
  const angle = value.match(/<([^>]+)>/);
  if (angle?.[1]) return angle[1].trim().toLowerCase();
  const plain = value.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}/);
  return plain?.[0]?.toLowerCase() || "";
}

async function getUserAccountEmailSet(userId) {
  const key = String(userId || "");
  if (accountEmailCache.has(key)) {
    return accountEmailCache.get(key);
  }
  const accounts = await EmailAccount.find({ userId }, { email: 1 }).lean();
  const set = new Set(
    (accounts || [])
      .map((acc) => String(acc?.email || "").toLowerCase().trim())
      .filter(Boolean)
  );
  accountEmailCache.set(key, set);
  return set;
}

function inferIncomingFromSender(sender = "", accountEmails = new Set()) {
  const senderLower = String(sender || "").toLowerCase();
  const senderEmail = extractEmail(senderLower);
  if (senderEmail && accountEmails.has(senderEmail)) {
    return false;
  }
  for (const email of accountEmails) {
    if (email && senderLower.includes(email)) {
      return false;
    }
  }
  return true;
}

/**
 * Action Re-evaluation Worker
 *
 * Purpose:
 * - Re-evaluates time-based action states
 * - Deadlines crossing "today"
 * - Follow-ups becoming overdue
 *
 * This worker is SAFE to run repeatedly.
 * No Gmail calls. No AI calls.
 */
export async function runActionReevaluation() {
  console.log("🔁 Action re-evaluation started");
  const now = new Date();
  const lookbackStart = new Date(now);
  lookbackStart.setDate(lookbackStart.getDate() - ACTION_LOOKBACK_DAYS);
  const staleCutoff = new Date(now.getTime() - STALE_HOURS * 60 * 60 * 1000);

  // Re-evaluate recent/stale items so decisions stay fresh even if older emails were never scored.
  const candidates = await Email.find({
    $or: [
      { date: { $gte: lookbackStart } },
      { actionLastEvaluatedAt: { $exists: false } },
      { actionLastEvaluatedAt: { $lte: staleCutoff } },
      { needsReply: true },
      { hasDeadline: true },
      { isFollowUp: true },
    ],
  })
    .select(
      "_id userId threadId messageId subject textBody snippet from to date isIncoming"
    )
    .sort({ date: -1 })
    .lean();

  console.log("📊 Action re-evaluation candidates:", candidates.length);

  const threadCache = new Map();
  const updates = [];

  for (const email of candidates) {
    const threadKey = `${String(email.userId)}:${String(email.threadId || email._id)}`;
    const accountEmails = await getUserAccountEmailSet(email.userId);

    let threadMessages = threadCache.get(threadKey);
    if (!threadMessages) {
      if (!email.threadId) {
        const single = buildEvalMessage(email);
        single.isIncoming = inferIncomingFromSender(single.from, accountEmails);
        threadMessages = [single];
      } else {
        const docs = await Email.find({
          userId: email.userId,
          threadId: email.threadId,
        })
          .select("_id messageId subject textBody snippet from to date isIncoming")
          .sort({ date: 1 })
          .lean();
        threadMessages = docs.map((doc) => {
          const normalized = buildEvalMessage(doc);
          normalized.isIncoming = inferIncomingFromSender(normalized.from, accountEmails);
          return normalized;
        });
      }
      threadCache.set(threadKey, threadMessages);
    }

    const normalizedEmail =
      threadMessages.find((msg) => String(msg._id) === String(email._id)) ||
      buildEvalMessage(email);
    normalizedEmail.isIncoming = inferIncomingFromSender(normalizedEmail.from, accountEmails);

    const heuristicActionData = evaluateActions(normalizedEmail, {
      messages: threadMessages,
      lastMessageFrom: normalizedEmail.isIncoming ? "them" : "me",
      lastMessageAt: normalizedEmail.date,
    });

    const finalActionData = {
      ...heuristicActionData,
      isIncoming: normalizedEmail.isIncoming,
      aiNeedsReply: null,
      aiHasDeadline: null,
      aiIsOverdueFollowUp: null,
      aiConfidence: null,
      aiExplanation: null,
      aiEvaluatedAt: null,
    };

    updates.push({
      updateOne: {
        filter: { _id: email._id },
        update: { $set: finalActionData },
      },
    });
  }

  if (updates.length > 0) {
    await Email.bulkWrite(updates, { ordered: false });
  }

  console.log("✅ Action re-evaluation finished");
  return {
    processed: updates.length,
    ranAt: now,
  };
}

/**
 * Execute when run directly (worker mode)
 * This ensures the worker actually runs instead of exiting.
 */
if (process.argv[1] && process.argv[1].includes("actionReevaluation.worker")) {
  (async () => {
    try {
      await runActionReevaluation();
      process.exit(0);
    } catch (err) {
      console.error("❌ Action re-evaluation failed:", err);
      process.exit(1);
    }
  })();
}
