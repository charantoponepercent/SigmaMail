import "dotenv/config";
import "../config/db.js";

import { Worker } from "bullmq";
import { redis } from "../utils/redis.js";
import { runInitialSync } from "../services/gmailInitialSync.service.js";

console.log("🚀 Gmail Initial Sync Worker started");

new Worker(
  "gmail-initial-sync",
  async (job) => {
    const { accountId } = job.data;
    await runInitialSync(accountId);
  },
  { connection: redis }
);