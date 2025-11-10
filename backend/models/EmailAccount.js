import mongoose from "mongoose";

const emailAccountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  provider: { type: String, default: "gmail" },
  email: { type: String, required: true },
  accessToken: { type: String },
  refreshToken: { type: String, required: true },
  tokenExpiry: { type: Date },
  scopes: [String],
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("EmailAccount", emailAccountSchema);
