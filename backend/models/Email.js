// models/Email.js
import mongoose from 'mongoose';

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
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailAccount', required: true },

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

    // 🧠 NEW — AI VECTOR EMBEDDING FIELD
    embedding: {
      type: [Number], // array of floats
      default: null,
      index: false,   // change to true only when using MongoDB vector indexing
    },
  },
  { timestamps: true }
);

export default mongoose.model('Email', EmailSchema);