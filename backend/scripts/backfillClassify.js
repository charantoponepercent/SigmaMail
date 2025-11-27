// scripts/backfillClassify.js
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "../.env") });
import mongoose from "mongoose";
import Email from "../models/Email.js";
import { classifyEmailFull } from "../classification/classificationEngine.js";

const MONGO = process.env.MONGO_URI;

async function main() {
  await mongoose.connect(MONGO);
  console.log("Connected to mongo");

  const cursor = Email.find({ embedding: { $ne: null } }).cursor();
  let count = 0;
  for await (const email of cursor) {
    try {
      const result = await classifyEmailFull({
        subject: email.subject || "",
        text: email.textBody || "",
        plainText: email.textBody || "",
        snippet: email.snippet || "",
        from: email.from || "",
        embedding: email.embedding || null
      });

      await Email.updateOne(
        { _id: email._id },
        {
          $set: {
            category: result.top,
            categoryScore: result.topScore,
            categoryCandidates: result.candidates,
            heuristic: result.heuristic,
            phrase: result.phrase,
            semantic: result.semantic,
            exclusion: result.exclusion
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