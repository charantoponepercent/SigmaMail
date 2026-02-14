import "dotenv/config";
import "../config/db.js";

import { Worker } from "bullmq";
import { getConfiguredRedisHost, getRedisClient } from "../utils/redis.js";
import { runInitialSync } from "../services/gmailInitialSync.service.js";

console.log("ℹ️ gmail-initial-sync worker redis config", {
  redisHost: getConfiguredRedisHost(),
});
const redis = getRedisClient({ required: true, purpose: "gmail-initial-sync worker" });


new Worker(
  "gmail-initial-sync",
  async (job) => {
    const { accountId } = job.data;
    await runInitialSync(accountId);
  },
  { connection: redis }
);
