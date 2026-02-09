// Quick harness to exercise classifyEmailFull with diverse samples.
// Run via: node backend/classification/testSamples.js

import { readFile } from "fs/promises";
import { classifyEmailFull } from "./classificationEngine.js";
import "../config/db.js";

const datasetPath = new URL("./sampleDataset.json", import.meta.url);
const datasetRaw = await readFile(datasetPath, "utf-8");
const SAMPLE_EMAILS = JSON.parse(datasetRaw);

async function runSamples() {
  for (const sample of SAMPLE_EMAILS) {
    const payload = {
      ...sample.email,
      plainText: sample.email.text,
      snippet: (sample.email.text || "").slice(0, 120),
    };
    const result = await classifyEmailFull(payload, { disableSemantic: true });
    const summary = result.candidates.slice(0, 3).map(c => `${c.name}:${c.score}`).join(", ");

    console.log(`\n=== ${sample.label} ===`);
    console.log(`Expected: ${sample.expected} | Predicted: ${result.top} (score ${result.topScore})`);
    console.log(`Top 3: ${summary}`);
  }
}

runSamples()
  .then(() => {
    console.log("\nDone.");
    process.exit(0);
  })
  .catch(err => {
    console.error("Classification test failed:", err);
    process.exit(1);
  });
