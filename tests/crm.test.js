import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStore } from "../lib/store.js";
import { normalizePhone, overdue, stats, validateLead } from "../lib/domain.js";
import { samples, sampleAnalysis } from "../lib/samples.js";
import { analyze, structured, draftReply } from "../lib/ai.js";
import { createApp } from "../server.js";
const savedEnv = Object.fromEntries(
  ["MODEL_API_KEY", "META_MODEL", "OPENAI_API_KEY", "OPENAI_MODEL"].map((k) => [
    k,
    process.env[k],
  ]),
);
test.before(() => {
  for (const k of Object.keys(savedEnv)) delete process.env[k];
});
test.after(() => {
  for (const [k, v] of Object.entries(savedEnv))
    if (v !== undefined) process.env[k] = v;
    else delete process.env[k];
});
test("All supplied messages survive import; duplicate identity, routing and unknowns remain truthful", () => {
  const store = createStore(":memory:");
  try {
    const leads = store.all();
    assert.deepEqual(
      { ...stats(leads, Date.parse("2026-11-03T12:00:00+06:00")) },
      { total: 19, sales: 15, overdue: 17, support: 2, messages: 20 },
    );
    assert.deepEqual(
      leads
        .flatMap((l) => l.messages.map((m) => Number(m.sourceId)))
        .sort((a, b) => a - b),
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
    assert.equal(
      leads.find((l) => l.phone === "01711000001").messages.length,
      2,
    );
    const bySource = (id) =>
      leads.find((l) => l.messages.some((m) => m.sourceId === String(id)));
    for (const id of [7, 16]) {
      assert.equal(bySource(id).route, "Support");
      assert.equal(bySource(id).status, "New");
    }
    assert.equal(bySource(11).route, "Spam");
    assert.equal(bySource(11).draft, "");
    assert.equal(bySource(20).route, "Careers");
    for (const id of [4, 5, 6, 8, 9, 13, 15, 17])
      assert.equal(bySource(id).program, "Unspecified");
    assert.equal(bySource(2).phone, "");
    assert.equal(bySource(2).language, "Bangla");
    assert.equal(bySource(1).language, "Banglish");
    assert.equal(bySource(3).language, "English");
    store.seed();
    assert.equal(stats(store.all()).messages, 20);
  } finally {
    store.close();
  }
});
test("SQLite changes survive reopening and phone normalization does not merge unknown contacts", () => {
  const dir = mkdtempSync(join(tmpdir(), "biai-crm-")),
    path = join(dir, "test.sqlite");
  let store = createStore(path);
  try {
    const lead = store.all()[0];
    lead.status = "Interested";
    store.write(lead);
    store.close();
    store = createStore(path);
    assert.equal(store.get(lead.id).status, "Interested");
    assert.equal(normalizePhone("+৮৮০১৭১১০০০০০১"), "01711000001");
    assert.equal(store.all().filter((l) => !l.phone).length, 6);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("48-hour boundary, scheduled reminders and closed/non-sales exclusions", () => {
  const now = Date.parse("2026-11-03T12:00:00+06:00"),
    base = {
      status: "New",
      route: "Sales",
      receivedAt: new Date(now - 172800000).toISOString(),
    };
  assert.equal(overdue(base, now), true);
  assert.equal(
    overdue(
      { ...base, receivedAt: new Date(now - 172799999).toISOString() },
      now,
    ),
    false,
  );
  assert.equal(
    overdue(
      { ...base, lastContactAt: new Date(now - 1000).toISOString() },
      now,
    ),
    false,
  );
  assert.equal(
    overdue({ ...base, nextFollowUp: new Date(now + 1000).toISOString() }, now),
    false,
  );
  assert.equal(overdue({ ...base, status: "Paid" }, now), false);
  assert.equal(overdue({ ...base, status: "Lost" }, now), false);
  assert.equal(overdue({ ...base, route: "Spam" }, now), false);
  assert.equal(overdue({ ...base, route: "Careers" }, now), false);
  assert.equal(overdue({ ...base, route: "Support" }, now), true);
});
test("Sample mode is explicit, exact-match only, and preserves all supplied messages", async () => {
  const key = process.env.OPENAI_API_KEY,
    model = process.env.OPENAI_MODEL;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
  try {
    for (const row of samples) {
      const result = await analyze({ message: row.message });
      assert.equal(result.mode, "sample");
      assert.equal(result.name, row["sender name"]);
      assert.ok(result.reason);
      if (result.route !== "Spam") assert.ok(result.reply);
    }
    await assert.rejects(
      analyze({ message: "An unsupported sample message" }),
      /Sample mode supports only/,
    );
  } finally {
    if (key !== undefined) process.env.OPENAI_API_KEY = key;
    if (model !== undefined) process.env.OPENAI_MODEL = model;
  }
});
test("AI wire contract requests strict schema; provider errors and invalid responses are surfaced", async () => {
  const schema = {
    type: "object",
    properties: { text: { type: "string" } },
    required: ["text"],
    additionalProperties: false,
  };
  const good = await structured(
    "rules",
    { message: "sample" },
    "test",
    schema,
    async (url, init) => {
      assert.equal(url, "https://api.openai.com/v1/responses");
      const sent = JSON.parse(init.body);
      assert.equal(sent.store, false);
      assert.equal(sent.text.format.strict, true);
      assert.deepEqual(sent.text.format.schema, schema);
      return {
        ok: true,
        json: async () => ({
          status: "completed",
          output: [
            { content: [{ type: "output_text", text: '{"text":"ok"}' }] },
          ],
        }),
      };
    },
  );
  assert.equal(good.text, "ok");
  await assert.rejects(
    structured("", "", "test", schema, async () => ({
      ok: false,
      status: 429,
    })),
    /429/,
  );
  await assert.rejects(
    structured("", "", "test", schema, async () => ({
      ok: true,
      json: async () => ({ status: "incomplete" }),
    })),
    /incomplete/,
  );
  await assert.rejects(
    structured("", "", "test", schema, async () => ({
      ok: true,
      json: async () => ({
        status: "completed",
        output: [{ content: [{ type: "output_text", text: "not json" }] }],
      }),
    })),
    /invalid data/,
  );
});
test("Invalid phone, stage and missing name are rejected", () => {
  const store = createStore(":memory:");
  try {
    const lead = store.all()[0];
    for (const bad of [
      { phone: "123" },
      { status: "Won" },
      { name: "" },
      { route: "Other" },
    ])
      assert.throws(() => validateLead({ ...lead, ...bad }));
  } finally {
    store.close();
  }
});
test("Meta uses its official endpoint and server-only key with schema validation", async () => {
  process.env.MODEL_API_KEY = "test-key";
  process.env.META_MODEL = "test-model";
  try {
    const result = await analyze(
      { message: samples[0].message },
      async (url, init) => {
        assert.equal(url, "https://api.meta.ai/v1/responses");
        assert.equal(init.headers.Authorization, "Bearer test-key");
        assert.equal(JSON.parse(init.body).model, "test-model");
        return {
          ok: true,
          json: async () => ({
            status: "completed",
            output: [
              {
                content: [
                  {
                    type: "output_text",
                    text: JSON.stringify(sampleAnalysis(samples[0])),
                  },
                ],
              },
            ],
          }),
        };
      },
    );
    assert.equal(result.mode, "live");
    await assert.rejects(
      analyze({ message: samples[0].message }, async () => ({
        ok: true,
        json: async () => ({
          status: "completed",
          output: [
            { content: [{ type: "output_text", text: '{"name":123}' }] },
          ],
        }),
      })),
      /invalid fields/,
    );
  } finally {
    delete process.env.MODEL_API_KEY;
    delete process.env.META_MODEL;
  }
});
test("HTTP workflow: sample extraction → reviewed save → stage edit → contact log → weekly brief", async () => {
  const store = createStore(":memory:"),
    server = createApp(store);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const base = "http://127.0.0.1:" + server.address().port;
  async function request(path, method = "GET", data, headers = {}) {
    const r = await fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    return { status: r.status, data: await r.json() };
  }
  try {
    const initial = await request("/api/state");
    assert.equal(initial.status, 200);
    assert.equal(initial.data.stats.messages, 20);
    const row = samples[0],
      draft = await request("/api/analyze", "POST", {
        message: row.message,
        name: row["sender name"],
        phone: row.phone,
        channel: row.channel,
      });
    assert.equal(draft.status, 200);
    const saved = await request("/api/leads", "POST", {
      ...draft.data,
      message: row.message,
      channel: row.channel,
      sourceId: row.id,
      receivedAt: "2026-10-26T09:12:00+06:00",
    });
    assert.equal(saved.status, 201);
    assert.equal(saved.data.duplicate, true);
    const id = saved.data.lead.id;
    assert.equal(
      (
        await request("/api/leads/" + id, "PATCH", {
          status: "Interested",
          owner: "Admissions",
        })
      ).data.status,
      "Interested",
    );
    assert.equal(
      (
        await request("/api/leads/" + id, "PATCH", {
          phone: store.all().find((l) => l.phone && l.id !== id).phone,
        })
      ).status,
      400,
    );
    assert.equal(
      (await request("/api/leads/" + id, "PATCH", { status: "Invalid" }))
        .status,
      400,
    );
    assert.equal(
      (await request("/api/leads/" + id + "/draft", "POST", {})).status,
      200,
    );
    assert.equal(
      (await request("/api/leads/" + id + "/contact", "POST", {})).status,
      200,
    );
    assert.equal(overdue(store.get(id)), false);
    const brief = await request("/api/summary", "POST", { end: "2026-11-01" });
    assert.equal(brief.status, 200);
    assert.match(brief.data.text, /20 enquiries/);
    const empty = await request("/api/summary", "POST", { end: "2026-09-01" });
    assert.match(empty.data.text, /0 enquiries/);
    assert.equal(
      (await request("/api/summary", "POST", { end: "invalid" })).status,
      400,
    );
    assert.equal(
      (
        await request(
          "/api/analyze",
          "POST",
          { message: row.message },
          { Origin: "https://evil.example" },
        )
      ).status,
      403,
    );
    assert.equal(
      (await request("/api/leads/not-found", "PATCH", { status: "New" }))
        .status,
      404,
    );
    const html = await fetch(base + "/");
    assert.equal(html.status, 200);
    assert.match(await html.text(), /BIAI/);
    assert.match(
      html.headers.get("content-security-policy"),
      /frame-ancestors 'none'/,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    store.close();
  }
});

test("Reviewed repeat intake saves edits and draft without duplicating messages or losing workflow fields", () => {
  const store = createStore(":memory:");
  try {
    const row = samples[0],
      lead = store.all().find((l) => l.phone === row.phone);
    lead.owner = "Admissions";
    lead.status = "Interested";
    lead.notes = "Keep this team note";
    store.write(lead);
    const saved = store.add({
      ...sampleAnalysis(row),
      name: "Rafi Ahmed",
      program: "Bootcamp",
      reply: "A human-reviewed reply",
      message: row.message,
      channel: row.channel,
      sourceId: row.id,
      applyReview: true,
      mode: "live",
    });
    assert.equal(saved.duplicate, true);
    assert.equal(saved.lead.draft, "A human-reviewed reply");
    assert.equal(saved.lead.draftMode, "live");
    assert.equal(saved.lead.status, "Interested");
    assert.equal(saved.lead.owner, "Admissions");
    assert.equal(saved.lead.notes, "Keep this team note");
    assert.equal(stats(store.all()).messages, 20);
  } finally {
    store.close();
  }
});

test("Practice workspace starts empty; Rafi repeat messages merge and preserve both original messages", () => {
  const store = createStore(":memory:", { seedSamples: false });
  try {
    assert.equal(store.all().length, 0);
    for (const row of [samples[0], samples[11]])
      store.add({
        ...sampleAnalysis(row),
        message: row.message,
        channel: row.channel,
        sourceId: row.id,
        applyReview: true,
      });
    assert.equal(store.all().length, 1);
    assert.equal(store.all()[0].messages.length, 2);
    assert.equal(store.all()[0].draft, sampleAnalysis(samples[11]).reply);
  } finally {
    store.close();
  }
});

test("Resolved support cases leave the reminder queue and new messages reopen them", () => {
  const store = createStore(":memory:");
  try {
    const lead = store
      .all()
      .find((l) => l.messages.some((m) => m.sourceId === "7"));
    lead.supportStatus = "Resolved";
    store.write(lead);
    assert.equal(overdue(lead), false);
    const result = store.add({
      ...sampleAnalysis(samples[6]),
      message: samples[6].message,
      channel: samples[6].channel,
      receivedAt: new Date().toISOString(),
      applyReview: true,
    });
    assert.equal(result.lead.supportStatus, "Open");
    assert.equal(result.lead.status, "New");
  } finally {
    store.close();
  }
});

test("HTTP saves edited drafts and support states, preserves future follow-ups and isolates practice records", async () => {
  const main = createStore(":memory:"),
    practice = createStore(":memory:", { seedSamples: false }),
    server = createApp(main, practice);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  const req = async (path, method = "GET", data) => {
    const r = await fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    return { status: r.status, value: await r.json() };
  };
  try {
    const lead = main.all().find((l) => l.route === "Support"),
      date = new Date(Date.now() + 86400000).toISOString();
    const saved = await req("/api/leads/" + lead.id, "PATCH", {
      draft: "Reviewed and saved",
      supportStatus: "Resolved",
      nextAction: "Verify receipt",
      nextFollowUp: date,
      priority: "Urgent",
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.value.draftMode, "human-reviewed");
    assert.equal(overdue(saved.value), false);
    const contacted = await req(
      "/api/leads/" + lead.id + "/contact",
      "POST",
      {},
    );
    assert.equal(contacted.value.nextFollowUp, date);
    assert.equal(contacted.value.draft, "Reviewed and saved");
    assert.equal(
      (await req("/api/state?workspace=practice")).value.leads.length,
      0,
    );
    const row = samples[1];
    await req("/api/leads?workspace=practice", "POST", {
      ...sampleAnalysis(row),
      message: row.message,
      channel: row.channel,
      sourceId: row.id,
    });
    assert.equal(practice.all().length, 1);
    assert.equal(main.all().length, 19);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    main.close();
    practice.close();
  }
});

test("Reply regeneration supplies full conversation, reviewed context and chosen language", async () => {
  process.env.MODEL_API_KEY = "test-key";
  process.env.META_MODEL = "test-model";
  const store = createStore(":memory:");
  try {
    const lead = store.all().find(l => l.name === "Rafi Ahmed");
    const result = await draftReply({...lead, language: "English"}, async (url, init) => {
      const body = JSON.parse(init.body);
      const context = JSON.parse(body.input);
      assert.equal(context.conversation.length, 2);
      assert.equal(context.replyLanguage, "English");
      assert.equal(context.phone, lead.phone);
      assert.equal(context.program, "Bootcamp");
      assert.match(body.instructions, /phone is missing/);
      return {ok:true,json:async()=>({status:"completed",output:[{content:[{type:"output_text",text:JSON.stringify({reply:"The team will confirm the bootcamp fee."})}]}]})};
    });
    assert.equal(result.mode, "live");
    await assert.rejects(draftReply({...lead, route:"Spam"}), /quarantined/);
  } finally {
    store.close();
    delete process.env.MODEL_API_KEY;
    delete process.env.META_MODEL;
  }
});

test("HTTP DELETE deletes a lead and heuristic extraction works on arbitrary messages", async () => {
  const main = createStore(":memory:"),
    server = createApp(main, main);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  try {
    const lead = main.all()[0];
    const delRes = await fetch(base + "/api/leads/" + lead.id, {
      method: "DELETE",
    });
    assert.equal(delRes.status, 200);
    assert.equal(main.all().length, 18);

    const analyzeRes = await fetch(base + "/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Ami Tanvir, bootcamp er fee koto? amar number 01812345678",
        channel: "WhatsApp",
      }),
    });
    assert.equal(analyzeRes.status, 200);
    const analyzed = await analyzeRes.json();
    assert.equal(analyzed.program, "Bootcamp");
    assert.equal(analyzed.phone, "01812345678");
    assert.equal(analyzed.language, "Banglish");
    assert.equal(analyzed.route, "Sales");
    assert.ok(analyzed.reply);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    main.close();
  }
});

