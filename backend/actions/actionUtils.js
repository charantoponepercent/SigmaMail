// backend/actions/actionUtils.js
// Shared helpers for action evaluators (needs reply, follow-ups, deadlines)

function toDate(value) {
  if (!value && value !== 0) return null;
  const date = typeof value === "number" ? new Date(value) : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getMessageTimestamp(message) {
  if (!message) return new Date();
  const candidates = [
    message.timestamp,
    message.internalDate,
    message.date,
    message.createdAt,
    message.sentAt,
    message.receivedAt,
    message.updatedAt,
    message.headerDate,
  ];

  for (const value of candidates) {
    const parsed = toDate(value);
    if (parsed) return parsed;
  }

  if (message.headers) {
    const headerVal = message.headers["Date"] || message.headers["date"];
    const parsed = toDate(headerVal);
    if (parsed) return parsed;
  }

  return new Date();
}

export function isIncomingMessage(message, fallback = true) {
  if (!message) return fallback;
  if (typeof message.isIncoming === "boolean") return message.isIncoming;
  if (typeof message.direction === "string") {
    return message.direction.toLowerCase() !== "outbound";
  }
  if (typeof message.fromSelf === "boolean") return !message.fromSelf;
  if (typeof message.sender === "string") {
    const normalized = message.sender.toLowerCase();
    if (normalized === "me" || normalized === "self" || normalized === "outbound") return false;
    if (normalized === "them" || normalized === "external" || normalized === "inbound") return true;
  }
  return fallback;
}

export function buildActionContext(email, thread = {}) {
  const collection = Array.isArray(thread?.messages) ? [...thread.messages] : [];
  if (email) collection.push(email);

  const deduped = [];
  const seenKeys = new Set();
  for (const msg of collection) {
    const key = msg?.id || msg?.messageId || `${msg?.subject || ""}-${getMessageTimestamp(msg).getTime()}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    deduped.push(msg);
  }

  deduped.sort((a, b) => getMessageTimestamp(a) - getMessageTimestamp(b));

  const lastIncoming = [...deduped].reverse().find(msg => isIncomingMessage(msg, true)) || null;
  const lastOutgoing = [...deduped].reverse().find(msg => !isIncomingMessage(msg, false)) || null;
  const lastMessage = deduped[deduped.length - 1] || null;

  const computedLastMessageFrom = lastMessage ? (isIncomingMessage(lastMessage) ? "them" : "me") : null;

  const context = {
    messages: deduped,
    lastIncoming,
    lastIncomingAt: lastIncoming ? getMessageTimestamp(lastIncoming) : null,
    lastOutgoing,
    lastOutgoingAt: lastOutgoing ? getMessageTimestamp(lastOutgoing) : null,
    lastMessage,
    lastMessageAt: lastMessage ? getMessageTimestamp(lastMessage) : (thread.lastMessageAt ? toDate(thread.lastMessageAt) : null),
    lastMessageFrom: computedLastMessageFrom ?? thread.lastMessageFrom ?? null,
    nextIncomingAfterLastOutgoing: null,
    conversationAgeHours: 0,
  };

  if (context.lastOutgoing) {
    context.nextIncomingAfterLastOutgoing = deduped.find(msg => {
      if (!isIncomingMessage(msg, true)) return false;
      return getMessageTimestamp(msg) > context.lastOutgoingAt;
    }) || null;
  }

  const firstMessage = deduped[0];
  if (firstMessage) {
    const ageHours = (Date.now() - getMessageTimestamp(firstMessage).getTime()) / (1000 * 60 * 60);
    context.conversationAgeHours = Number(ageHours.toFixed(2));
  }

  return context;
}

export default {
  getMessageTimestamp,
  isIncomingMessage,
  buildActionContext,
};
