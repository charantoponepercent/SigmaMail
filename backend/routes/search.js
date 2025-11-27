import express from "express";
import Email from "../models/Email.js";
import { generateEmbedding } from "../utils/embedding.js";

const router = express.Router();

router.post("/search", async (req, res) => {
  try {
    const { query, mode = "semantic", limit = 50 } = req.body;

    if (!query || query.trim().length === 0) {
      return res.json({ results: [] });
    }

    // 1️⃣ Generate query embedding
    const queryEmbedding = await generateEmbedding(query);

    // 2️⃣ Fetch emails that have embeddings
    const emails = await Email.find({ embedding: { $ne: null } }).lean();

    // 3️⃣ Compute cosine similarity
    const scored = emails.map((email) => {
      const emb = email.embedding;
      let dot = 0, na = 0, nb = 0;

      for (let i = 0; i < emb.length; i++) {
        dot += emb[i] * queryEmbedding[i];
        na += emb[i] * emb[i];
        nb += queryEmbedding[i] * queryEmbedding[i];
      }

      const sim = dot / (Math.sqrt(na) * Math.sqrt(nb));
      return { email, score: sim };
    });

    // 4️⃣ Sort by similarity
    scored.sort((a, b) => b.score - a.score);

    // 5️⃣ Return results
    res.json({
      ok: true,
      query,
      results: scored.slice(0, limit),
    });
  } catch (err) {
    console.error("❌ Search error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;