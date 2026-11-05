import { responsesReply, withEnv } from "../helpers/env.js";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { analyze, autoReplyDecision, checkReply, draftReply, structured } from "../../src/services/ai/ai.service.js";
import { samples, sampleAnalysis } from "../../src/services/ai/samples.js";
import { mergeAnalysis } from "../../src/modules/leads/leads.service.js";

const META = { MODEL_API_KEY: "test-key", META_MODEL: "test-model" };
const ids = (violations) => violations.map((v) => v.id).sort();

const liveResult = (overrides = {}) => ({
  name: "Nadia",
  phone: "",
  program: "Bootcamp",
  route: "Sales",
  language: "English",
  urgent: false,
  confidence: "high",
  nextAction: "Call about the bootcamp",
  reason: "Asks about the bootcamp.",
  reply: "Thanks for asking about the Bootcamp! Our team will confirm the next batch. Could you share a contact number?",
  ...overrides,
});

/** A fetcher that returns each payload in turn (the last one repeats). */
const sequence = (...payloads) => {
  let i = 0;
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    const next = payloads[Math.min(i++, payloads.length - 1)];
    return typeof next === "function" ? next() : responsesReply(next)();
  };
  fetcher.calls = calls;
  return fetcher;
};

describe("reply policy", () => {
  test("flags invented prices, dates, guarantees, payment confirmations and claims", () => {
    const opts = { language: "English", route: "Sales" };
    assert.deepEqual(ids(checkReply("The bootcamp costs 15,000 taka.", opts)), ["price"]);
    assert.deepEqual(ids(checkReply("Fee is ৳5000.", opts)), ["price"]);
    assert.deepEqual(ids(checkReply("The next batch starts on 15 November.", opts)), ["date"]);
    assert.deepEqual(ids(checkReply("We guarantee a job after the course.", opts)), ["guarantee"]);
    assert.deepEqual(ids(checkReply("Your payment has been received, thank you.", opts)), ["payment"]);
    assert.deepEqual(ids(checkReply("We have already escalated your case.", opts)), ["claim"]);
    assert.deepEqual(ids(checkReply("Apply at https://forms.example.com", opts)), ["link"]);
    assert.deepEqual(checkReply("Email recruitment@biai.com.bd for details.", opts), []);
  });

  test("checks the reply language and spam", () => {
    assert.deepEqual(ids(checkReply("Thank you for asking.", { language: "Bangla", route: "Sales" })), ["language"]);
    assert.deepEqual(ids(checkReply("ধন্যবাদ", { language: "Banglish", route: "Sales" })), ["language"]);
    assert.deepEqual(checkReply("", { language: "English", route: "Spam" }), []);
    assert.deepEqual(ids(checkReply("", { language: "English", route: "Sales" })), ["empty"]);
  });

  test("most reviewed sample replies already meet the policy", () => {
    const clean = samples.filter((row) => {
      const reviewed = sampleAnalysis(row);
      return reviewed.route === "Spam" || !checkReply(reviewed.reply, reviewed).length;
    });
    assert.ok(clean.length >= 18, `${clean.length} of 20 clean`);
  });
});

describe("auto-reply gate", () => {
  const lead = { route: "Sales", status: "New", priority: "Normal", owner: "", messages: [] };
  const analysis = { ...liveResult(), mode: "live", policy: [] };

  test("sends only a confident, policy-clean live sales reply", () => {
    assert.equal(autoReplyDecision({ setting: "safe", analysis, lead }).send, true);
    assert.match(autoReplyDecision({ setting: "off", analysis, lead }).reason, /off/);
  });

  test("holds every uncertain case for a person", () => {
    const held = (a, l = lead) => autoReplyDecision({ setting: "safe", analysis: { ...analysis, ...a }, lead: { ...lead, ...l } });
    assert.match(held({ route: "Support" }, { route: "Support" }).reason, /Support/);
    assert.match(held({ mode: "heuristic" }).reason, /Rule-based/);
    assert.match(held({ confidence: "medium" }).reason, /confidence/);
    assert.match(held({ urgent: true }).reason, /urgent/);
    assert.match(held({ policy: [{ id: "price", label: "States a price" }] }).reason, /price/);
    assert.match(held({}, { owner: "Tanvir" }).reason, /Tanvir/);
    const twoAuto = [{ direction: "outbound", delivery: "auto" }, { direction: "inbound" }, { direction: "outbound", delivery: "auto" }];
    assert.match(held({}, { messages: twoAuto }).reason, /person takes over/);
    const humanSince = [...twoAuto.slice(0, 2), { direction: "outbound", delivery: "manual" }, { direction: "outbound", delivery: "auto" }];
    assert.equal(autoReplyDecision({ setting: "safe", analysis, lead: { ...lead, messages: humanSince } }).send, true);
  });
});

describe("live analysis pipeline", () => {
  test("repairs fields instead of discarding a good result; deterministic facts win", async () => {
    await withEnv(META, async () => {
      const result = await analyze(
        { message: "Bootcamp কবে শুরু? আমার নম্বর ০১৭১২৩৪৫৬৭৮", name: "", phone: "" },
        sequence(liveResult({ phone: "12345", language: "English", program: "Masterclass", reply: "বুটক্যাম্পের পরবর্তী ব্যাচের তারিখ টিম নিশ্চিত করে জানাবে।" })),
      );
      assert.equal(result.mode, "live");
      assert.equal(result.phone, "01712345678", "phone from the message, not the model");
      assert.equal(result.language, "Bangla", "Bangla script decides the language");
      assert.equal(result.program, "Unspecified", "an unknown programme is repaired, not fatal");
      assert.deepEqual(result.policy, []);
    });
  });

  test("keeps the known contact's programme and sends the conversation as context", async () => {
    await withEnv(META, async () => {
      const fetcher = sequence(liveResult({ program: "Unspecified", confidence: "medium", reply: "You're welcome! Let us know if you have any other questions." }));
      const context = {
        name: "Rafi",
        phone: "01711000001",
        program: "Bootcamp",
        route: "Sales",
        status: "Contacted",
        conversation: [{ from: "customer", text: "Bootcamp price?" }, { from: "biai", text: "The team will confirm." }],
      };
      const result = await analyze({ message: "ok thanks", phone: "01711000001", context }, fetcher);
      assert.equal(result.program, "Bootcamp");
      assert.equal(result.name, "Rafi");
      assert.equal(fetcher.calls[0].body.input.includes("Bootcamp price?"), true);
    });
  });

  test("a policy violation gets one corrected rewrite", async () => {
    await withEnv(META, async () => {
      const fetcher = sequence(
        liveResult({ reply: "The bootcamp fee is 12,000 taka and starts on 5 December." }),
        { reply: "Thanks for asking! Our team will confirm the bootcamp fee and next batch date. Could you share your number?" },
      );
      const result = await analyze({ message: "bootcamp fee?", name: "Nadia" }, fetcher);
      assert.equal(fetcher.calls.length, 2);
      assert.deepEqual(fetcher.calls[1].body.input.includes("States a price"), true);
      assert.deepEqual(result.policy, []);
      assert.doesNotMatch(result.reply, /taka|December/);
    });
  });

  test("transient provider errors are retried", async () => {
    await withEnv(META, async () => {
      const fetcher = sequence(() => ({ ok: false, status: 503 }), liveResult());
      const result = await analyze({ message: "bootcamp?", name: "Nadia" }, fetcher);
      assert.equal(result.mode, "live");
      assert.equal(fetcher.calls.length, 2);
      // A 400 is not retried.
      const bad = sequence(() => ({ ok: false, status: 400 }));
      await assert.rejects(analyze({ message: "bootcamp?" }, bad), /400/);
      assert.equal(bad.calls.length, 1);
    });
  });

  test("provider failure falls back to labelled rules that still use the known contact", async () => {
    await withEnv(META, async () => {
      const result = await analyze(
        { message: "any update?", phone: "01711000001", context: { name: "Rafi", phone: "01711000001", program: "Fellowship" }, allowHeuristic: true },
        async () => ({ ok: false, status: 500 }),
      );
      assert.equal(result.mode, "heuristic");
      assert.equal(result.confidence, "low");
      assert.equal(result.program, "Fellowship");
      assert.match(result.reason, /Live AI unavailable/);
    });
  });

  test("drafted replies are policy-checked too", async () => {
    await withEnv(META, async () => {
      const lead = { name: "Rafi", phone: "01711000001", program: "Bootcamp", route: "Sales", language: "English", notes: "", messages: [{ text: "price?", channel: "WhatsApp" }] };
      const result = await draftReply(lead, sequence({ reply: "It costs 9000 tk." }, { reply: "It is 9000 tk." }));
      assert.equal(result.mode, "live");
      assert.deepEqual(ids(result.policy), ["price"], "a remaining violation is reported, never hidden");
    });
  });
});

describe("Gemini provider", () => {
  test("sends the key in a header and a schema without additionalProperties", async () => {
    await withEnv({ GEMINI_API_KEY: "g-key", GEMINI_MODEL: "gemini-test" }, async () => {
      const schema = { type: "object", properties: { text: { type: "string" } }, required: ["text"], additionalProperties: false };
      const value = await structured("rules", { a: 1 }, "t", schema, async (url, init) => {
        assert.doesNotMatch(url, /key=/);
        assert.equal(init.headers["x-goog-api-key"], "g-key");
        const body = JSON.parse(init.body);
        assert.equal(JSON.stringify(body.generationConfig.response_schema).includes("additionalProperties"), false);
        return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"text":"hi"}' }] } }] }) };
      });
      assert.equal(value.text, "hi");
    });
  });
});

describe("follow-up merge", () => {
  const existing = { name: "Rafi", phone: "01711000001", program: "Bootcamp", route: "Sales", language: "English", priority: "Normal", nextAction: "" };

  test("never downgrades what is known", () => {
    const changes = mergeAnalysis(existing, { name: "Unknown", phone: "", program: "Unspecified", route: "Sales", language: "Banglish", reply: "r", mode: "live" });
    assert.equal(changes.program, undefined);
    assert.equal(changes.name, undefined);
    assert.equal(changes.route, undefined);
    assert.equal(changes.language, "Banglish");
  });

  test("fills gaps, changes a clearly new programme and only escalates the queue", () => {
    const unknown = { ...existing, name: "Unknown", phone: "" };
    const changes = mergeAnalysis(unknown, { name: "Rafi Ahmed", phone: "01711000009", program: "Fellowship", route: "Support", priority: "Urgent", reply: "", mode: "live" });
    assert.equal(changes.name, "Rafi Ahmed");
    assert.equal(changes.phone, "01711000009");
    assert.equal(changes.program, "Fellowship");
    assert.equal(changes.route, "Support");
    assert.equal(changes.priority, "Urgent");
    assert.equal(mergeAnalysis({ ...existing, route: "Support" }, { route: "Sales" }).route, undefined, "never leaves Support automatically");
  });
});
