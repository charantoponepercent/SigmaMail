

import EventEmitter from "events";

/**
 * Shared EventEmitter for inbox SSE events.
 * IMPORTANT: This must be imported by BOTH
 * - backend/index.js (SSE route)
 * - workers/gmailPush.worker.js (emitters)
 */
export const inboxEvents = new EventEmitter();

// Prevent MaxListeners warnings in long-lived SSE connections
inboxEvents.setMaxListeners(0);