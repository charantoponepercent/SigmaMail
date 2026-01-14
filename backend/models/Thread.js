import mongoose from 'mongoose';

const ThreadSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailAccount', required: true },
    threadId: { type: String, required: true },

    messageIds: [String],
    participants: [String],
    subject: String,
    snippet: String,
    lastMessageDate: Date,
    unreadCount: { type: Number, default: 0 },
    hasUnread: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model('Thread', ThreadSchema);