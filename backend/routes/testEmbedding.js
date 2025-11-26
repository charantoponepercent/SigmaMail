// routes/test.js
import express from "express";
import { classifyEmailFull } from "../classification/classificationEngine.js";

const router = express.Router();

router.post("/test-classify", async (req, res) => {
  try {
    const result = await classifyEmailFull({
      subject: req.body.subject,
      textBody: req.body.text,
      snippet: "",
      from: req.body.from || ""
    });

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;