import { responsesReply, withEnv } from "../helpers/env.js";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  analyze,
  draftReply,
  heuristicAnalyze,
  rulePriorities,
  structured,
  summarize,
} from "../../src/services/ai/ai.service.js";
import { sampleAnalysis, samples } from "../../src/services/ai/samples.js";

const META = { MODEL_API_KEY: "test-key", META_MODEL: "test-model" };

describe("offline mode", () => {
  test("the 20 supplied messages use labelled, reviewed sample interpretations", async () => {
    for (const row of samples) {
      const result = await analyze({ message: row.message });
      assert.equal(result.mode, "sample");
      assert.equal(result.name, row["sender name"]);
      if (result.route !== "Spam") assert.ok(result.reply, `reply for #${row.id}`);
    }
  });

  test("other text needs live AI unless the rule-based fallback is allowed", async () => {
    await assert.rejects(analyze({ message: "An unsupported message" }), /Sample mode supports only/);
    const result = await analyze({ message: "I want the AI bootcamp. 01712345678", allowHeuristic: true });
    assert.equal(result.mode, "heuristic");
    assert.equal(result.program, "Bootcamp");
    assert.equal(result.phone, "01712345678");
  });

  test("rule-based replies never state unconfirmed course details", () => {
    const { reply } = heuristicAnalyze({ message: "bootcamp er details din", phone: "" });
    assert.doesNotMatch(reply, /3[- ]day|৳|Tk|\d+ ?taka/i);
  });

  test("rule-based weekly priorities come from the data", () => {
    const priorities = rulePriorities({
      count: 3,
      overdue: 2,
      notes: [
        { name: "Farzana", route: "Support", program: "Unspecified" },
        { name: "Sabbir", route: "Sales", program: "Unspecified" },
      ],
    });
    assert.equal(priorities.length, 3);
    assert.match(priorities[0], /2 overdue/);
    assert.match(priorities[1], /Farzana/);
    assert.match(priorities[2], /1 sales contact/);
  });
});

describe("live provider contract", () => {
  const schema = {
    type: "object",
    properties: { text: { type: "string" } },
    required: ["text"],
    additionalProperties: false,
  };

  test("requests a strict JSON schema and surfaces provider errors", async () => {
    await withEnv({ OPENAI_API_KEY: "k", OPENAI_MODEL: "m" }, async () => {
      const good = await structured("rules", { message: "x" }, "test", schema, async (url, init) => {
        assert.equal(url, "https://api.openai.com/v1/responses");
        const sent = JSON.parse(init.body);
        assert.equal(sent.store, false);
        assert.equal(sent.text.format.strict, true);
        assert.deepEqual(sent.text.format.schema, schema);
        return responsesReply({ text: "ok" })();
      });
      assert.equal(good.text, "ok");
      await assert.rejects(structured("", "", "t", schema, async () => ({ ok: false, status: 429 })), /429/);
      await assert.rejects(
        structured("", "", "t", schema, async () => ({ ok: true, json: async () => ({ status: "incomplete" }) })),
        /incomplete/,
      );
      await assert.rejects(structured("", "", "t", schema, responsesReply("not json")), /invalid data/);
    });
  });

  test("Meta uses its official endpoint with a server-only key, and invalid fields are rejected", async () => {
    await withEnv(META, async () => {
      const result = await analyze({ message: samples[0].message }, async (url, init) => {
        assert.equal(url, "https://api.meta.ai/v1/responses");
        assert.equal(init.headers.Authorization, "Bearer test-key");
        assert.equal(JSON.parse(init.body).model, "test-model");
        return responsesReply(sampleAnalysis(samples[0]))();
      });
      assert.equal(result.mode, "live");
      await assert.rejects(analyze({ message: samples[0].message }, responsesReply({ name: 123 })), /invalid fields/);
    });
  });

  test("reply drafting sends the whole conversation and the chosen language", async () => {
    await withEnv(META, async () => {
      const lead = {
        name: "Rafi Ahmed",
        phone: "01711000001",
        program: "Bootcamp",
        route: "Sales",
        language: "English",
        notes: "",
        messages: samples.filter((s) => s["sender name"] === "Rafi Ahmed").map((s) => ({ text: s.message, channel: s.channel })),
      };
      const result = await draftReply(lead, async (_url, init) => {
        const body = JSON.parse(init.body);
        const context = JSON.parse(body.input);
        assert.equal(context.conversation.length, 2);
        assert.equal(context.replyLanguage, "English");
        return responsesReply({ reply: "The team will confirm the bootcamp fee." })();
      });
      assert.equal(result.mode, "live");
      await assert.rejects(draftReply({ ...lead, route: "Spam" }), /quarantined/);
    });
  });

  test("weekly priorities fall back to rules, with a notice, when the provider fails", async () => {
    await withEnv(META, async () => {
      const input = { count: 1, overdue: 1, notes: [] };
      const live = await summarize(input, responsesReply({ priorities: ["Call Rafi", "Check Farzana", "Ask Sabbir"] }));
      assert.equal(live.mode, "live");
      assert.equal(live.priorities.length, 3);
      const fallback = await summarize(input, async () => ({ ok: false, status: 500 }));
      assert.equal(fallback.mode, "rules");
      assert.match(fallback.notice, /unavailable/);
    });
  });
});
