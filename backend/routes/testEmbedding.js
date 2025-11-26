import express from "express";
import { generateEmbedding } from "../utils/embedding.js";

const router = express.Router();

router.post("/test/embedding", async (req, res) => {
  try {
    const { text } = req.body;

    const vector = await generateEmbedding(text);

    res.json({
      success: true,
      length: vector.length,
      sample: vector.slice(0, 5),
    });
  } catch (err) {
    console.error("Test embedding error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

export default router;