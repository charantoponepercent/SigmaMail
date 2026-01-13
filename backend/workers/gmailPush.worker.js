import "dotenv/config";
import "../config/db.js";
import { Worker } from "bullmq";
import { redis } from "../utils/redis.js";

console.log("📡 Gmail Push Worker running");

new Worker(
  "gmail-push",
  async (job) => {
    const { emailAddress, historyId } = job.data;
    console.log("📨 Push received:", emailAddress, historyId);
  },
  { connection: redis }
);