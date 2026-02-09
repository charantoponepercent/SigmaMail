// Production-grade dataset evaluation harness
// Run via: node backend/classification/runDatasetEval.js

import { readFile } from "fs/promises";
import { classifyEmailFull } from "./classificationEngine.js";
import "../config/db.js"

const disableSemantic = process.env.CLASSIFIER_EVAL_DISABLE_SEMANTIC === "true";
const datasetPath = new URL("./sampleDataset.json", import.meta.url);
const dataset = JSON.parse(await readFile(datasetPath, "utf-8"));

const perCategory = {};
const misclassifications = [];

for (const sample of dataset) {
  const payload = {
    ...sample.email,
    plainText: sample.email.text,
    snippet: (sample.email.text || "").slice(0, 160),
  };

  const result = await classifyEmailFull(payload, { disableSemantic });
  const predicted = result.top;
  const correct = predicted === sample.expected;

  perCategory[sample.expected] = perCategory[sample.expected] || { total: 0, correct: 0 };
  perCategory[sample.expected].total += 1;
  if (correct) perCategory[sample.expected].correct += 1;

  if (!correct) {
    misclassifications.push({
      label: sample.label,
      expected: sample.expected,
      predicted,
      topScore: result.topScore,
      candidates: result.candidates.slice(0, 3),
    });
  }
}

const totals = Object.values(perCategory).reduce(
  (acc, cat) => {
    acc.total += cat.total;
    acc.correct += cat.correct;
    return acc;
  },
  { total: 0, correct: 0 }
);

const accuracy = totals.total === 0 ? 0 : (totals.correct / totals.total) * 100;

console.log("=== Classification Dataset Evaluation ===");
console.log(`Samples: ${totals.total}`);
console.log(`Accuracy: ${accuracy.toFixed(2)}% (disableSemantic=${disableSemantic})\n`);

console.log("Per-category accuracy:");
for (const [category, stats] of Object.entries(perCategory)) {
  const pct = stats.total === 0 ? 0 : (stats.correct / stats.total) * 100;
  console.log(` - ${category}: ${stats.correct}/${stats.total} (${pct.toFixed(1)}%)`);
}

if (misclassifications.length) {
  console.log("\nMisclassifications:");
  for (const miss of misclassifications) {
    console.log(` • ${miss.label}: expected ${miss.expected}, predicted ${miss.predicted} (score ${miss.topScore})`);
    console.log(`   Top candidates: ${miss.candidates.map(c => `${c.name}:${c.score}`).join(", ")}`);
  }
} else {
  console.log("\nNo misclassifications detected.");
}
