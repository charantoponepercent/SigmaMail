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
import {
  closeRedis,
  getRedisClient,
  getRedisStatus,
  shouldUseRedisForCache,
  shouldUseRedisForQueues,
  shouldUseRedisForSseBridge,
  shouldUseRedisForTelemetry,
} from "./utils/redis.js";
import {
  scheduleActionReevaluation,
  stopActionReevaluationScheduler,
} from "./schedulers/actionReevaluation.scheduler.js";


dotenv.config();
const DEBUG_REALTIME = true;
const redisExpected =
  shouldUseRedisForQueues() ||
  shouldUseRedisForSseBridge() ||
  shouldUseRedisForCache() ||
  shouldUseRedisForTelemetry();

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
  const redisStatus = getRedisStatus();
  const redisReady =
    !redisExpected ||
    redisStatus === "ready" ||
    redisStatus === "not-initialized";
  const ready = mongoReady && redisReady;

  res.status(ready ? 200 : 503).json({
    status: ready ? "ready" : "degraded",
    checks: {
      mongo: mongoReady ? "ready" : "not-ready",
      redis: redisExpected
        ? redisStatus === "not-initialized"
          ? "lazy"
          : redisReady
            ? "ready"
            : redisStatus || "not-ready"
        : "disabled",
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

  if (DEBUG_REALTIME) {
    console.log("[Realtime] SSE client connected", {
      userId: String(userId),
    });
  }

  const keepAlive = setInterval(() => {
    // SSE comment frame keeps proxies/connections alive.
    res.write(": ping\n\n");
  }, 25000);

  const sendEvent = (payload) => {
    if (String(payload.userId) !== String(userId)) return;
    if (DEBUG_REALTIME) {
      console.log("[Realtime] SSE deliver", {
        targetUserId: String(userId),
        eventType: payload?.type,
      });
    }
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  inboxEvents.on("inbox", sendEvent);

  req.on("close", () => {
    if (DEBUG_REALTIME) {
      console.log("[Realtime] SSE client disconnected", {
        userId: String(userId),
      });
    }
    clearInterval(keepAlive);
    inboxEvents.removeListener("inbox", sendEvent);
  });
});

let sseWorker = null;
if (shouldUseRedisForSseBridge()) {
  const redis = getRedisClient({ required: true, purpose: "sse bridge worker" });
  sseWorker = new Worker(
    "sse-events",
    async (job) => {
      const rawUserId = job?.data?.userId;
      if (!rawUserId) return;

      const eventType = job?.name || "NEW_EMAIL";
      if (DEBUG_REALTIME) {
        console.log("[Realtime] Queue -> SSE", {
          eventType,
          userId: String(rawUserId),
        });
      }
      inboxEvents.emit("inbox", {
        type: eventType,
        userId: String(rawUserId),
        data: job?.data?.data || null,
      });
    },
    { connection: redis }
  );
} else {
  console.log("ℹ️ SSE queue bridge is disabled (REDIS_SSE_BRIDGE_ENABLED=false).");
}

const PORT = process.env.PORT || 4000;
// ----------------------------------------
// Schedule Action Re-evaluation (once)
// ----------------------------------------
try {
  scheduleActionReevaluation();
} catch (error) {
  console.error("⚠️ Failed to schedule action re-evaluation:", error);
}

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

async function shutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  stopActionReevaluationScheduler();
  try {
    if (sseWorker) {
      await sseWorker.close();
    }
  } catch (error) {
    console.error("Error closing worker:", error);
  }
  try {
    await closeRedis();
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
