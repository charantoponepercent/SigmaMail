// models/Email.js
import mongoose from "mongoose";

const InlineImageSchema = new mongoose.Schema({
  cid: String,
  mimeType: String,
  size: Number,
  storageUrl: String,
});

const AttachmentSchema = new mongoose.Schema({
  filename: String,
  mimeType: String,
  size: Number,
  storageUrl: String,
});

const EmailSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: "EmailAccount", required: true },

    messageId: { type: String, required: true },
    threadId: { type: String, required: true },

    subject: String,
    from: String,
    to: String,
    cc: String,
    bcc: String,
    date: Date,

    textBody: String,
    htmlBodyRaw: String,
    htmlBodyProcessed: String,

    inlineImages: [InlineImageSchema],
    attachments: [AttachmentSchema],

    labelIds: [String],
    snippet: String,
    isRead: { type: Boolean, default: false },
    hasInlineImages: { type: Boolean, default: false },
    hasAttachments: { type: Boolean, default: false },

    isExternal: { type: Boolean, default: false },
    provider: { type: String },

    /* ------------------------------------------------
       🧠 ADVANCED AI CLASSIFIER FIELDS (L1–L4 + Embedding)
    --------------------------------------------------- */

    // L5 Embedding Vector (for semantic similarity)
    embedding: {
      type: [Number],
      default: null,
      index: false,
    },

    // Final fused category
    category: { type: String, index: true, default: null },
    categoryScore: { type: Number, default: null },

    // All category scores from all layers
    categoryCandidates: {
      type: Object, // not array — store dictionary { Work: score, Finance: score }
      default: {},
    },

    // L1 + L3 heuristic scores
    heuristic: {
      type: Object,
      default: {},
    },

    // L2 phrase scoring
    phrase: {
      type: Object,
      default: {},
    },

    // L5 semantic embedding similarity scoring
    semantic: {
      type: Object,
      default: {},
    },

    // L4 exclusion penalties applied
    exclusion: {
      type: Object,
      default: {},
    },

    /* ----------------------------------------
       📌 ACTION INTELLIGENCE (Today's Decisions)
    ----------------------------------------- */

    // Incoming vs outgoing (derived once)
    isIncoming: { type: Boolean, index: true },

    // ---------- Needs Reply ----------
    needsReply: { type: Boolean, default: false, index: true },
    needsReplyScore: { type: Number, default: 0 }, // heuristic + AI boost
    needsReplyReason: { type: String }, // "question", "request", "ai_detected"

    // ---------- Deadlines ----------
    hasDeadline: { type: Boolean, default: false, index: true },
    deadlineAt: { type: Date, index: true },
    deadlineSource: { type: String }, // "explicit", "relative", "ai"
    deadlineConfidence: { type: Number, default: 0 }, // 0–1

    // ---------- Follow-ups ----------
    isFollowUp: { type: Boolean, default: false, index: true },
    followUpWaitingSince: { type: Date }, // when user last replied
    followUpThresholdHours: { type: Number, default: 48 },
    isOverdueFollowUp: { type: Boolean, default: false, index: true },

    // ---------- AI Augmentation ----------
    aiNeedsReply: {
      type: Boolean,
      default: null,
    },

    aiHasDeadline: {
      type: Boolean,
      default: null,
    },

    aiIsOverdueFollowUp: {
      type: Boolean,
      default: null,
    },

    aiConfidence: {
      type: Number,
      default: null,
    },

    aiExplanation: {
      type: String,
      default: null,
    },

    aiEvaluatedAt: {
      type: Date,
      default: null,
    },

    // ---------- System ----------
    actionLastEvaluatedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("Email", EmailSchema);