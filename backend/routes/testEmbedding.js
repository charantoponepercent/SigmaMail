// routes/test.js
import express from "express";
import { classifyEmailFull } from "../classification/classificationEngine.js";

const router = express.Router();

router.post("/test-classify", async (req, res) => {
  try {
    const result = await classifyEmailFull({
      subject: req.body.subject || "",
      text: req.body.text || "",        // <-- Correct field
      plainText: req.body.text || "",   // <-- Also feed to plainText
      snippet: "",
      from: req.body.from || ""
    });

    res.json({
      ok: true,
      result
    });
  } catch (e) {
    console.error("❌ /test-classify failed:", e);
    res.status(500).json({ error: e.message });
  }
});

export default router;