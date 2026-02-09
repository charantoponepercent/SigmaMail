// models/Category.js
import mongoose from "mongoose";

const CategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    aliases: { type: [String], default: [] },
    description: { type: String, required: true },
    priority: { type: Number, default: 0 },
    enabled: { type: Boolean, default: true },
    // embedding stored as array of numbers (normalized vector)
    embedding: { type: [Number], default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    // optional metadata
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export default mongoose.model("Category", CategorySchema);
