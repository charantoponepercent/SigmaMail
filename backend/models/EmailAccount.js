import mongoose from "mongoose";

const emailAccountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  provider: { type: String, default: "gmail" },
  email: { type: String, required: true },
  googleId: String,
  accessToken: String,
  refreshToken: String,     // <--- encrypt in production!
  tokenExpiry: Date,
  scopes: [String],
  initialSyncDone: { type: Boolean, default: false },
  lastHistoryId: { type: String },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

emailAccountSchema.index({ userId: 1, email: 1 }, { unique: true });

export default mongoose.models.EmailAccount || mongoose.model("EmailAccount", emailAccountSchema);
