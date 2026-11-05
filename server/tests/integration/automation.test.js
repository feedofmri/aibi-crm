import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { databaseUnavailable, startTestApp } from "../helpers/test-app.js";

const skip = await databaseUnavailable();

// A fake "live" analyzer: complete sales enquiries unless the text says otherwise.
let failNext = false;
const fakeAnalyze = async (input) => {
  if (failNext) {
    failNext = false;
    throw new Error("AI service returned 503.");
  }
  return {
    name: input.name || "Unknown",
    phone: input.phone,
    program: /fellowship/i.test(input.message) ? "Fellowship" : "Bootcamp",
    route: /refund/i.test(input.message) ? "Support" : "Sales",
    language: "English",
    reason: "Test analysis",
    reply: "Thanks, the team will confirm details.",
    mode: "live",
  };
};

describe("automated intake", { skip }, () => {
  let app;
  let admin;
  before(async () => {
    app = await startTestApp({ ai: { analyze: fakeAnalyze }, seed: false });
    admin = await app.signIn();
  });
  after(() => app?.close());

  test("automatic mode saves complete sales enquiries with a 48-hour follow-up and reuses duplicate jobs", async () => {
    const sales = await app.signIn("rahim@biai.com.bd");
    assert.equal((await sales.put("/api/automation/settings", { mode: "automatic" })).status, 403);
    assert.equal((await admin.put("/api/automation/settings", { mode: "automatic" })).status, 200);

    const input = { message: "Bootcamp seats?", channel: "WhatsApp", name: "Lina", phone: "01722222222" };
    const { job } = (await admin.post("/api/automation/jobs", input)).body;
    assert.equal(job.status, "Completed");
    const lead = (await admin.get(`/api/leads/${job.leadId}`)).body.lead;
    const hours = (Date.parse(lead.nextFollowUp) - Date.now()) / 3600000;
    assert.ok(hours > 47 && hours <= 48, `follow-up in ${hours}h`);
    assert.equal(lead.nextAction, "Review draft and contact enquiry");

    const again = (await admin.post("/api/automation/jobs", input)).body.job;
    assert.equal(again.id, job.id);
    assert.equal((await admin.get("/api/leads")).body.leads.length, 1);
  });

  test("exceptions wait for a person, who can edit, approve or reject", async () => {
    const support = (await admin.post("/api/automation/jobs", { message: "I want a refund", channel: "WhatsApp", name: "Omar", phone: "" })).body.job;
    assert.equal(support.status, "Pending");
    assert.ok(support.reasons.includes("Missing phone"));
    assert.ok(support.reasons.includes("Support enquiry needs review"));

    const approved = (await admin.post(`/api/automation/jobs/${support.id}/review`, { action: "approve", changes: { phone: "01733333333" } })).body.job;
    assert.equal(approved.status, "Approved");
    const lead = (await admin.get(`/api/leads/${approved.leadId}`)).body.lead;
    assert.equal(lead.phone, "01733333333");
    assert.equal(lead.status, "New", "approval never marks payment or progress");

    const other = (await admin.post("/api/automation/jobs", { message: "Fellowship?", channel: "Website form", name: "", phone: "" })).body.job;
    const rejected = (await admin.post(`/api/automation/jobs/${other.id}/review`, { action: "reject" })).body.job;
    assert.equal(rejected.status, "Rejected");
    assert.equal((await admin.post(`/api/automation/jobs/${other.id}/review`, { action: "approve" })).status, 400);
  });

  test("provider failures keep the input, create nothing and can be retried", async () => {
    const before = (await admin.get("/api/leads")).body.leads.length;
    const input = { message: "Bootcamp batch?", channel: "WhatsApp", name: "Rumi", phone: "01744444444" };
    failNext = true;
    const failed = (await admin.post("/api/automation/jobs", input)).body.job;
    assert.equal(failed.status, "Failed");
    assert.match(failed.error, /503/);
    assert.equal((await admin.get("/api/leads")).body.leads.length, before);

    const retried = (await admin.post("/api/automation/jobs", input)).body.job;
    assert.equal(retried.id, failed.id);
    assert.equal(retried.status, "Completed");
  });

  test("manual mode holds every result for review", async () => {
    await admin.put("/api/automation/settings", { mode: "manual" });
    const { job } = (await admin.post("/api/automation/jobs", { message: "Bootcamp fee?", channel: "WhatsApp", name: "Sara", phone: "01755555555" })).body;
    assert.equal(job.status, "Pending");
    const { jobs, settings } = (await admin.get("/api/automation")).body;
    assert.equal(settings.mode, "manual");
    assert.ok(jobs.length >= 4);
  });
});
