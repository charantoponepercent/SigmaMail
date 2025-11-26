// scripts/backfillClassify.js
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "../.env") });
import mongoose from "mongoose";
import Email from "../models/Email.js";
import { classifyEmbedding } from "../utils/classify.js";

const MONGO = process.env.MONGO_URI;

async function main() {
  await mongoose.connect(MONGO);
  console.log("Connected to mongo");

  const cursor = Email.find({ embedding: { $ne: null } }).cursor();
  let count = 0;
  for await (const email of cursor) {
    try {
      const scored = await classifyEmbedding(email.embedding, 3);
      const top = scored && scored.length ? scored[0] : null;
      await Email.updateOne(
        { _id: email._id },
        {
          $set: {
            category: top ? top.name : null,
            categoryScore: top ? top.score : null,
            categoryCandidates: scored,
          },
        }
      );
      count++;
      if (count % 100 === 0) console.log("Processed:", count);
    } catch (err) {
      console.error("Backfill error for", email._id, err);
    }
  }

  console.log("Backfill done");
  await mongoose.disconnect();
  process.exit(0);
}

main();