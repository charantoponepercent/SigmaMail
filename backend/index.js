import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import apiRoutes from './routes/apiRoutes.js';
import userAuthRoutes from './routes/userAuthRoutes.js';
import testEmbedding from "./routes/testEmbedding.js";
import searchRoutes from "./routes/search.js";
import "./config/db.js";
import gmailWebhook from "./routes/gmailWebhook.js";
import { inboxEvents } from "./events/inboxEvents.js";
import { Worker } from "bullmq";
import { redis } from "./utils/redis.js";
import { scheduleActionReevaluation } from "./schedulers/actionReevaluation.scheduler.js";


dotenv.config();

const app = express();

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(cors());


// Test route
app.get('/', (req, res) => {
  res.send('Backend API is working ✅');
});

app.use("/authe", userAuthRoutes);
app.use("/auth", authRoutes); // ✅
app.use("/api", apiRoutes);
app.use("/test", testEmbedding);
app.use("/search_api", searchRoutes);
app.use("/api-push/webhooks", gmailWebhook);

app.get("/api-sse/sse/inbox", (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    return res.status(400).end();
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendEvent = (payload) => {
    if (payload.userId !== userId) return;
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  inboxEvents.on("inbox", sendEvent);

  req.on("close", () => {
    inboxEvents.removeListener("inbox", sendEvent);
  });
});

// 🔁 BullMQ → SSE bridge (runs in API process)
new Worker(
  "sse-events",
  async (job) => {
    inboxEvents.emit("inbox", {
      type: "NEW_EMAIL",          // 🔴 FIX: explicit event type
      userId: job.data.userId,
      data: job.data.data || null,
    });

    console.log("📡 SSE emitted → NEW_EMAIL for user:", job.data.userId);
  },
  { connection: redis }
);

const PORT = process.env.PORT || 4000;
// ----------------------------------------
// Schedule Action Re-evaluation (once)
// ----------------------------------------
await scheduleActionReevaluation();

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
