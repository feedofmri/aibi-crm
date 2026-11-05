import { writeFileSync } from "node:fs";
import { samples, sampleAnalysis } from "../src/services/ai/samples.js";
import { analyze, autoReplyDecision, liveEnabled, aiConfig } from "../src/services/ai/ai.service.js";
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
  agent: {
    policyClean: results.filter((r) => r.actual && !r.actual.policy?.length).length + "/" + samples.length,
    highConfidence: results.filter((r) => r.actual?.confidence === "high").length + "/" + samples.length,
    urgent: results.filter((r) => r.actual?.urgent).map((r) => r.id),
    wouldAutoReply: results
      .filter((r) => r.actual && autoReplyDecision({ setting: "safe", analysis: r.actual, lead: { route: r.actual.route, status: "New", priority: "Normal", owner: "", messages: [] } }).send)
      .map((r) => r.id),
    avgLatencyMs: Math.round(results.reduce((n, r) => n + r.latencyMs, 0) / Math.max(results.length, 1)),
  },
  replyReview:
    "Reply wording must be manually reviewed for language and usefulness. The policy check covers prices, dates, guarantees, payment confirmations, claims, links and script, not tone.",
  results,
};
writeFileSync(
  new URL("../../docs/evidence/live-ai-evaluation.json", import.meta.url),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify({ successful: report.successful, scores: report.scores, agent: report.agent }, null, 2),
);
if (report.successful !== samples.length) process.exitCode = 1;
