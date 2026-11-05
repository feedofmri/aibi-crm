import test from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../lib/store.js";
import { createAutomation } from "../lib/automation.js";
import { samples, sampleAnalysis } from "../lib/samples.js";
const input = (s) => ({
  message: s.message,
  channel: s.channel,
  name: s["sender name"],
  phone: s.phone,
});
const analyzer = async (i) =>
  sampleAnalysis(samples.find((s) => s.message === i.message));
test("Automatic processing saves complete sales leads, schedules follow-up and prevents duplicate jobs", async () => {
  const store = createStore(":memory:", { seedSamples: false });
  try {
    store.saveSettings({ mode: "automatic" });
    const auto = createAutomation(store, analyzer);
    const job = await auto.process(input(samples[0]));
    assert.equal(job.status, "Completed");
    assert.equal(store.all().length, 1);
    assert.ok(store.all()[0].nextFollowUp);
    assert.equal(store.all()[0].status, "New");
    assert.ok(store.all()[0].draft);
    assert.equal((await auto.process(input(samples[0]))).id, job.id);
    assert.equal(store.all()[0].messages.length, 1);
    const follow = await auto.process(
      input(samples.find((s) => s.id === "12")),
    );
    assert.equal(follow.status, "Pending");
    auto.review(follow.id, "approve");
    assert.equal(store.all()[0].messages.length, 2);
  } finally {
    store.close();
  }
});
test("Manual and exception review support edits, rejection and payment verification boundaries", async () => {
  const store = createStore(":memory:", { seedSamples: false });
  try {
    const auto = createAutomation(store, analyzer);
    let job = await auto.process(input(samples[0]));
    assert.equal(job.status, "Pending");
    assert.equal(store.all().length, 0);
    auto.review(job.id, "approve", { reply: "Reviewed draft" });
    assert.equal(store.all()[0].draft, "Reviewed draft");
    assert.throws(() => auto.review(job.id, "approve"), /pending/);
    store.saveSettings({ mode: "automatic" });
    job = await auto.process(input(samples.find((s) => s.id === "7")));
    assert.equal(job.status, "Pending");
    job = auto.review(job.id, "approve");
    assert.equal(store.get(job.leadId).status, "New");
    assert.equal(store.get(job.leadId).route, "Support");
    job = await auto.process(input(samples.find((s) => s.id === "2")));
    assert.equal(job.status, "Pending");
    auto.review(job.id, "reject");
    assert.equal(store.all().length, 2);
  } finally {
    store.close();
  }
});
test("Provider failures retain inputs, retry safely and do not create contacts", async () => {
  const store = createStore(":memory:", { seedSamples: false });
  try {
    let fail = true;
    const auto = createAutomation(store, async (i) => {
      if (fail) throw Error("Provider unavailable");
      return analyzer(i);
    });
    const first = await auto.process(input(samples[0]));
    assert.equal(first.status, "Failed");
    assert.equal(store.all().length, 0);
    fail = false;
    const retry = await auto.process(input(samples[0]));
    assert.equal(retry.id, first.id);
    assert.equal(retry.status, "Pending");
    assert.equal(store.jobs().length, 1);
    assert.throws(() => store.saveSettings({ mode: "invalid" }));
  } finally {
    store.close();
  }
});
