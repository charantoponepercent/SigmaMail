import mongoose from "mongoose";

const CategorizationRuleSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    category: { type: String, required: true, index: true },
    senderDomain: { type: String, required: true, index: true },
    senderEmails: { type: [String], default: [] },
    keywordWeights: {
      type: Map,
      of: Number,
      default: {},
    },
    feedbackCount: { type: Number, default: 1 },
    lastFeedbackAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

CategorizationRuleSchema.index(
  { userId: 1, category: 1, senderDomain: 1 },
  { unique: true, name: "uniq_user_category_domain" }
);

export default mongoose.model("CategorizationRule", CategorizationRuleSchema);
