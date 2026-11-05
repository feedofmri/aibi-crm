import { writeFileSync } from "node:fs";
import { samples, sampleAnalysis } from "./lib/samples.js";
import { analyze, liveEnabled, aiConfig } from "./lib/ai.js";
if (!liveEnabled())
  throw new Error(
    "Configure a live API key and model in .env first. This command makes 20 paid model requests.",
  );
const results = [];
for (const row of samples) {
  const expected = sampleAnalysis(row),
    start = Date.now();
  try {
    const actual = await analyze({
      message: row.message,
      name: row["sender name"],
      phone: row.phone,
      channel: row.channel,
    });
    const checks = Object.fromEntries(
      ["name", "phone", "program", "route", "language"].map((k) => [
        k,
        actual[k] === expected[k],
      ]),
    );
    results.push({
      id: row.id,
      checks,
      expected: {
        program: expected.program,
        route: expected.route,
        language: expected.language,
      },
      actual,
      latencyMs: Date.now() - start,
    });
    console.log(
      `#${row.id}: ${
        Object.entries(checks)
          .filter(([, v]) => !v)
          .map(([k]) => k)
          .join(", ") || "all extraction checks passed"
      }`,
    );
  } catch (e) {
    results.push({
      id: row.id,
      error: e.message,
      latencyMs: Date.now() - start,
    });
    console.log(`#${row.id}: ${e.message}`);
  }
}
const report = {
  generatedAt: new Date().toISOString(),
  provider: aiConfig().provider,
  model: aiConfig().model,
  baseline:
    "Human-reviewed interpretations, not official BIAI labels. Same supplied examples used during prompt development; this is a sample regression check, not a held-out benchmark.",
  count: results.length,
  successful: results.filter((r) => !r.error).length,
  scores: Object.fromEntries(
    ["name", "phone", "program", "route", "language"].map((k) => [
      k,
      results.filter((r) => r.checks?.[k]).length + "/" + samples.length,
    ]),
  ),
  replyReview:
    "Reply wording must be manually reviewed for language, usefulness and unsupported policy claims. Extraction scores do not measure reply quality.",
  results,
};
writeFileSync(
  new URL("./docs/live-ai-evaluation.json", import.meta.url),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify({ successful: report.successful, scores: report.scores }),
);
if (report.successful !== samples.length) process.exitCode = 1;
