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
app.set("trust proxy", 1);

function parseCsvEnv(value = "") {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const isProduction = process.env.NODE_ENV === "production";
const explicitOrigins = parseCsvEnv(
  process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || ""
);
const devOrigins = ["http://localhost:3000", "http://127.0.0.1:3000"];
const allowAllOrigins = explicitOrigins.includes("*");
const allowedOrigins = Array.from(
  new Set(
    allowAllOrigins
      ? []
      : [...explicitOrigins, ...(isProduction ? [] : devOrigins)]
  )
);

if (isProduction && !allowAllOrigins && allowedOrigins.length === 0) {
  throw new Error(
    "CORS_ORIGINS (or CORS_ORIGIN) must be set in production."
  );
}

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser clients (curl, health checks)
      if (!origin) return callback(null, true);
      if (allowAllOrigins) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);


// Test route
app.get('/', (req, res) => {
  res.send('Backend API is working ✅');
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    uptimeSec: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.get("/ready", (req, res) => {
  const mongoReady = mongoose.connection.readyState === 1;
  const redisReady = redis.status === "ready";
  const ready = mongoReady && redisReady;

  res.status(ready ? 200 : 503).json({
    status: ready ? "ready" : "degraded",
    checks: {
      mongo: mongoReady ? "ready" : "not-ready",
      redis: redisReady ? "ready" : redis.status || "not-ready",
    },
    timestamp: new Date().toISOString(),
  });
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
const sseWorker = new Worker(
  "sse-events",
  async (job) => {
    inboxEvents.emit("inbox", {
      type: "NEW_EMAIL",          // 🔴 FIX: explicit event type
      userId: job.data.userId,
      data: job.data.data || null,
    });

    // console.log("📡 SSE emitted → NEW_EMAIL for user:", job.data.userId);
  },
  { connection: redis }
);

const PORT = process.env.PORT || 4000;
// ----------------------------------------
// Schedule Action Re-evaluation (once)
// ----------------------------------------
try {
  await scheduleActionReevaluation();
} catch (error) {
  console.error("⚠️ Failed to schedule action re-evaluation:", error);
}

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

async function shutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  try {
    await sseWorker.close();
  } catch (error) {
    console.error("Error closing worker:", error);
  }
  try {
    await redis.quit();
  } catch (error) {
    console.error("Error closing Redis:", error);
  }
  server.close(() => process.exit(0));
}

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  shutdown("SIGINT");
});
