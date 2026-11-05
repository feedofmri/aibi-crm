import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { seedSampleLeads } from "../../src/db/seed.js";
import { samples } from "../../src/services/ai/samples.js";
import { databaseUnavailable, startTestApp } from "../helpers/test-app.js";

const skip = await databaseUnavailable();
const byName = (leads, name) => leads.find((l) => l.name === name);

describe("contacts, intake and follow-ups", { skip }, () => {
  let app;
  let admin;
  before(async () => {
    app = await startTestApp();
    admin = await app.signIn();
  });
  after(() => app?.close());

  test("the 20 supplied messages import as 19 truthful contacts", async () => {
    const { leads } = (await admin.get("/api/leads")).body;
    assert.equal(leads.length, 19);
    assert.equal(leads.reduce((n, l) => n + l.messages.length, 0), 20);
    const count = (route) => leads.filter((l) => l.route === route).length;
    assert.deepEqual([count("Sales"), count("Support"), count("Careers"), count("Spam")], [15, 2, 1, 1]);
    assert.equal(byName(leads, "Rafi Ahmed").messages.length, 2);
    assert.ok(leads.every((l) => l.status === "New"), "imports never claim progress");
    assert.equal(byName(leads, "Habibur Rahman").priority, "Urgent");
    assert.equal(leads.filter((l) => !l.phone).length, 6, "blank phones never merge");
  });

  test("importing again does not duplicate contacts or messages", async () => {
    await seedSampleLeads(app.pool, app.services.leadsService, { force: true });
    const { leads } = (await admin.get("/api/leads")).body;
    assert.equal(leads.length, 19);
    assert.equal(leads.reduce((n, l) => n + l.messages.length, 0), 20);
  });

  test("reviewed intake of a supplied message updates the contact without duplicating it", async () => {
    const row = samples.find((s) => s.id === "2");
    const analysis = (await admin.post("/api/intake/analyze", { message: row.message, channel: row.channel })).body.analysis;
    assert.equal(analysis.mode, "sample");

    const fake = await admin.post("/api/intake", { ...analysis, message: "edited", channel: row.channel, sourceId: "2" });
    assert.equal(fake.status, 400, "sample ids must match their supplied message");

    const res = await admin.post("/api/intake", {
      ...analysis,
      reply: "Edited reply",
      message: row.message,
      channel: row.channel,
      sourceId: row.id,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.created, false);
    assert.equal(res.body.lead.messages.length, 1);
    assert.equal(res.body.lead.draft, "Edited reply");
  });

  test("a new phone creates a contact; the same phone later joins it", async () => {
    const base = { channel: "WhatsApp", name: "Karim", program: "Bootcamp", route: "Sales", language: "English", mode: "manual" };
    const first = await admin.post("/api/intake", { ...base, message: "Bootcamp?", phone: "+880 1712-345678" });
    assert.equal(first.status, 201);
    assert.equal(first.body.lead.phone, "01712345678");
    const second = await admin.post("/api/intake", { ...base, message: "Any update?", phone: "01712345678" });
    assert.equal(second.status, 200);
    assert.equal(second.body.lead.id, first.body.lead.id);
    assert.equal(second.body.lead.messages.length, 2);
  });

  test("edits are validated, attributed and described in plain words", async () => {
    const { leads } = (await admin.get("/api/leads")).body;
    const rafi = byName(leads, "Rafi Ahmed");
    const tanvir = await app.signIn("tanvir@biai.com.bd");

    const res = await tanvir.patch(`/api/leads/${rafi.id}`, { status: "Interested", owner: "Tanvir Ahmed", draft: "Edited by a person" });
    assert.equal(res.status, 200);
    assert.equal(res.body.lead.draftMode, "human-reviewed");
    const recent = res.body.lead.activity.slice(-3).map((a) => `${a.action} | ${a.author}`);
    assert.ok(recent.includes("Moved stage from New to Interested | Tanvir Ahmed"), recent.join("\n"));
    assert.ok(recent.includes("Assigned to Tanvir Ahmed | Tanvir Ahmed"));

    assert.equal((await tanvir.patch(`/api/leads/${rafi.id}`, { status: "Won" })).status, 400);
    assert.equal((await tanvir.patch(`/api/leads/${rafi.id}`, { phone: "123" })).status, 400);
    assert.equal((await tanvir.patch(`/api/leads/${rafi.id}`, { unknown: 1 })).status, 400);
    const other = byName(leads, "Sabbir");
    assert.equal((await tanvir.patch(`/api/leads/${other.id}`, { phone: rafi.phone })).status, 409);
    assert.equal((await tanvir.get("/api/leads/not-a-uuid")).status, 404);
  });

  test("logging contact restarts the 48-hour clock and keeps future scheduled follow-ups", async () => {
    const { leads } = (await admin.get("/api/leads")).body;
    const sabbir = byName(leads, "Sabbir");
    const future = new Date(Date.now() + 3 * 86400000).toISOString();
    await admin.patch(`/api/leads/${sabbir.id}`, { nextFollowUp: future });
    const res = await admin.post(`/api/leads/${sabbir.id}/contact`);
    assert.equal(res.body.lead.status, "Contacted");
    assert.ok(res.body.lead.lastContactAt);
    assert.equal(Date.parse(res.body.lead.nextFollowUp), Date.parse(future));
  });

  test("resolved support cases reopen when a new message arrives", async () => {
    const { leads } = (await admin.get("/api/leads")).body;
    const farzana = byName(leads, "Farzana Rahman");
    await admin.patch(`/api/leads/${farzana.id}`, { supportStatus: "Resolved" });
    const res = await admin.post("/api/intake", {
      message: "Still no confirmation",
      channel: "WhatsApp",
      name: farzana.name,
      phone: farzana.phone,
      program: farzana.program,
      route: "Support",
      language: "English",
    });
    assert.equal(res.body.lead.supportStatus, "Open");
  });

  test("reply drafts are refused for spam and labelled for everything else", async () => {
    const { leads } = (await admin.get("/api/leads")).body;
    assert.equal((await admin.post(`/api/leads/${leads.find((l) => l.route === "Spam").id}/draft`)).status, 400);
    const res = await admin.post(`/api/leads/${byName(leads, "Tahmina Akter").id}/draft`);
    assert.equal(res.status, 200);
    assert.ok(["sample", "heuristic"].includes(res.body.lead.draftMode));
  });

  test("the weekly brief counts are calculated, not generated", async () => {
    const res = await admin.get("/api/reports/weekly?end=2026-11-01");
    const { report } = res.body;
    assert.equal(report.totals.messages, 20);
    assert.equal(report.totals.support, 2);
    assert.equal(report.mode, "rules");
    assert.equal(report.priorities.length, 3);
    assert.equal((await admin.get("/api/reports/weekly?end=nope")).status, 400);
    const empty = (await admin.get("/api/reports/weekly?end=2026-01-01")).body.report;
    assert.equal(empty.totals.messages, 0);
  });

  test("admins can restore the sample data", async () => {
    assert.equal((await admin.post("/api/admin/reset-demo")).body.imported, 20);
    assert.equal((await admin.get("/api/leads")).body.leads.length, 19);
  });
});
