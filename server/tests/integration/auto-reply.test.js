import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { databaseUnavailable, startTestApp } from "../helpers/test-app.js";
import * as realAi from "../../src/services/ai/ai.service.js";

const skip = await databaseUnavailable();
const KEY = { "X-Channel-Key": "dev-channel-key" };

// A fake live analyzer: confident sales answers, unless the text says otherwise.
const seen = [];
const fakeAnalyze = async (input) => {
  seen.push(input);
  const support = /refund|payment/i.test(input.message);
  const program = /fellowship/i.test(input.message) ? "Fellowship" : /bootcamp/i.test(input.message) ? "Bootcamp" : "Unspecified";
  const result = {
    name: input.name || input.context?.name || "Unknown",
    phone: input.phone || input.context?.phone || "",
    program: program === "Unspecified" && input.context?.program ? input.context.program : program,
    route: support ? "Support" : "Sales",
    language: "English",
    urgent: support,
    confidence: /\?$/.test(input.message.trim()) || support ? "high" : "medium",
    nextAction: "Call back",
    reason: "Test analysis",
    reply: /price/i.test(input.message) ? "It costs 5000 taka." : "Thanks! Our team will confirm the details. When is a good time to call?",
    mode: "live",
  };
  return { ...result, policy: realAi.checkReply(result.reply, result) };
};

describe("auto-reply and reply tracking", { skip }, () => {
  let app;
  let admin;
  const send = (body) => app.client().post("/api/channels/inbound", { channel: "WhatsApp", ...body }, KEY);

  before(async () => {
    app = await startTestApp({ ai: { analyze: fakeAnalyze }, seed: false });
    admin = await app.signIn();
  });
  after(() => app?.close());

  test("auto-reply is off by default: replies are held as drafts", async () => {
    const res = await send({ message: "Is the bootcamp online?", name: "Mitu", phone: "01811111111" });
    assert.equal(res.body.reply.status, "held");
    assert.match(res.body.reply.reason, /off/);
  });

  test("with safe auto-reply, a confident sales reply is sent and recorded", async () => {
    assert.equal((await admin.put("/api/automation/settings", { autoReply: "safe" })).status, 200);
    const settings = (await admin.get("/api/automation")).body.settings;
    assert.deepEqual(settings, { mode: "manual", autoReply: "safe" }, "mode is preserved by a partial update");

    const res = await send({ message: "Is the fellowship part-time?", name: "Sumi", phone: "01822222222" });
    assert.equal(res.status, 201);
    assert.equal(res.body.reply.status, "sent");

    const lead = (await admin.get(`/api/leads/${res.body.contact.id}`)).body.lead;
    const outbound = lead.messages.filter((m) => m.direction === "outbound");
    assert.equal(outbound.length, 1);
    assert.equal(outbound[0].delivery, "auto");
    assert.equal(lead.status, "Contacted");
    assert.ok(lead.lastContactAt);
    assert.equal(lead.draft, "", "a sent draft is cleared");
  });

  test("uncertain, unsafe or support messages are held, with the reason logged", async () => {
    const medium = await send({ message: "hello", name: "Rina", phone: "01833333333" });
    assert.equal(medium.body.reply.status, "held");
    assert.match(medium.body.reply.reason, /confidence/);

    const price = await send({ message: "bootcamp price?", name: "Rina", phone: "01833333333" });
    assert.equal(price.body.reply.status, "held");
    assert.match(price.body.reply.reason, /price/);

    const support = await send({ message: "I paid but got no confirmation, refund?", name: "Kamal", phone: "01844444444" });
    assert.equal(support.body.reply.status, "held");
    assert.equal(support.body.contact.priority, "Urgent");

    const lead = (await admin.get(`/api/leads/${price.body.contact.id}`)).body.lead;
    assert.ok(lead.activity.some((a) => /Auto-reply held/.test(a.action)));
  });

  test("follow-ups use the conversation and never reset known facts", async () => {
    const first = await send({ message: "Tell me about the bootcamp?", name: "Joy", phone: "01855555555" });
    assert.equal(first.body.contact.program, "Bootcamp");
    seen.length = 0;
    const second = await send({ message: "ok thanks", phone: "01855555555" });
    assert.equal(second.body.contact.id, first.body.contact.id);
    assert.equal(second.body.contact.program, "Bootcamp", "a vague follow-up keeps the programme");
    assert.equal(second.body.contact.name, "Joy");
    assert.ok(seen[0].context?.conversation?.length >= 2, "analysis received the conversation (incl. our reply)");
    assert.equal(second.body.contact.messages, 2, "only customer messages are counted");
  });

  test("after two automatic replies in a row a person takes over", async () => {
    const phone = "01866666666";
    assert.equal((await send({ message: "Fellowship details?", name: "Tara", phone })).body.reply.status, "sent");
    assert.equal((await send({ message: "Is it online?", phone })).body.reply.status, "sent");
    const third = await send({ message: "And on weekends?", phone });
    assert.equal(third.body.reply.status, "held");
    assert.match(third.body.reply.reason, /person takes over/);
  });

  test("a team member can record a reply they sent; it joins the conversation", async () => {
    const res = await send({ message: "Need info on corporate training?", name: "Firm", phone: "01877777777" });
    const id = res.body.contact.id;
    await admin.put("/api/automation/settings", { autoReply: "off" });
    const empty = await admin.post(`/api/leads/${id}/reply`, { text: "  " });
    assert.equal(empty.status, 400);
    const saved = await admin.post(`/api/leads/${id}/reply`, { text: "Hi! I'll call you this afternoon." });
    assert.equal(saved.status, 200);
    const last = saved.body.lead.messages.at(-1);
    assert.equal(last.direction, "outbound");
    assert.equal(last.delivery, "manual");
    assert.equal(last.author, "Admin BIAI");
  });
});
