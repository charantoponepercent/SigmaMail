

import { DEADLINE_CONFIDENCE_THRESHOLD } from "./types.js";

/**
 * Deadline evaluation
 * Extracts explicit and relative deadlines from email content.
 * No AI yet — purely heuristic and deterministic.
 */
export function evaluateDeadline(email) {
  const result = {
    hasDeadline: false,
    deadlineAt: null,
    deadlineSource: null,
    deadlineConfidence: 0,
  };

  if (!email) return result;

  const text = `${email.subject || ""} ${email.text || ""}`.toLowerCase();

  // ---------- Explicit date patterns (simple) ----------
  // Matches formats like: 18 Jan, Jan 18, 2026-01-18
  const dateRegex =
    /\b(\d{1,2}\s?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s?\d{1,2}|\d{4}-\d{2}-\d{2})\b/;

  const match = text.match(dateRegex);
  if (match) {
    const parsed = Date.parse(match[0]);
    if (!isNaN(parsed)) {
      result.hasDeadline = true;
      result.deadlineAt = new Date(parsed);
      result.deadlineSource = "explicit";
      result.deadlineConfidence = 0.8;
    }
  }

  // ---------- Relative keywords ----------
  const now = new Date();

  if (!result.hasDeadline) {
    if (text.includes("today") || text.includes("eod")) {
      const eod = new Date(now);
      eod.setHours(23, 59, 59, 999);

      result.hasDeadline = true;
      result.deadlineAt = eod;
      result.deadlineSource = "relative";
      result.deadlineConfidence = 0.7;
    }

    if (text.includes("tomorrow")) {
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 999);

      result.hasDeadline = true;
      result.deadlineAt = tomorrow;
      result.deadlineSource = "relative";
      result.deadlineConfidence = 0.6;
    }
  }

  // ---------- Final decision ----------
  if (result.deadlineConfidence >= DEADLINE_CONFIDENCE_THRESHOLD) {
    result.hasDeadline = true;
  } else {
    result.hasDeadline = false;
    result.deadlineAt = null;
    result.deadlineSource = null;
  }

  return result;
}