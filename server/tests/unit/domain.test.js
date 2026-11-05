import "../helpers/env.js";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { flags, normalizePhone, overdue, stats, validateLead, validPhone } from "../../src/domain/lead.js";

const NOW = Date.parse("2026-11-03T12:00:00+06:00");
const HOUR = 3600000;

const lead = (overrides = {}) => ({
  name: "Rafi Ahmed",
  phone: "01711000001",
  program: "Bootcamp",
  route: "Sales",
  language: "Banglish",
  status: "New",
  owner: "",
  notes: "",
  nextFollowUp: "",
  receivedAt: new Date(NOW - 48 * HOUR).toISOString(),
  messages: [],
  ...overrides,
});

describe("phone numbers", () => {
  test("normalises Bangladesh prefixes and Bangla digits", () => {
    assert.equal(normalizePhone("+880 1711-000001"), "01711000001");
    assert.equal(normalizePhone("০১৭১১০০০০০১"), "01711000001");
    assert.equal(normalizePhone(""), "");
  });

  test("accepts valid mobile numbers or blank, rejects others", () => {
    assert.ok(validPhone("01711000001"));
    assert.ok(validPhone(""));
    assert.ok(!validPhone("123"));
    assert.ok(!validPhone("01211000001"));
  });
});

describe("48-hour follow-up rule", () => {
  test("is due exactly at 48 hours and not a millisecond before", () => {
    assert.equal(overdue(lead(), NOW), true);
    assert.equal(overdue(lead({ receivedAt: new Date(NOW - 48 * HOUR + 1).toISOString() }), NOW), false);
  });

  test("a logged contact restarts the clock; a future scheduled date takes precedence", () => {
    assert.equal(overdue(lead({ lastContactAt: new Date(NOW - 1000).toISOString() }), NOW), false);
    assert.equal(overdue(lead({ nextFollowUp: new Date(NOW + 1000).toISOString() }), NOW), false);
    assert.equal(overdue(lead({ nextFollowUp: new Date(NOW - 1000).toISOString() }), NOW), true);
  });

  test("closed, spam, careers and resolved support contacts are excluded", () => {
    for (const excluded of [
      { status: "Paid" },
      { status: "Lost" },
      { route: "Spam" },
      { route: "Careers" },
      { route: "Support", supportStatus: "Resolved" },
    ])
      assert.equal(overdue(lead(excluded), NOW), false, JSON.stringify(excluded));
    assert.equal(overdue(lead({ route: "Support", supportStatus: "Open" }), NOW), true);
  });
});

describe("validation", () => {
  test("rejects invalid phone, stage, queue and missing name", () => {
    for (const bad of [{ phone: "123" }, { status: "Won" }, { name: "  " }, { route: "Other" }])
      assert.throws(() => validateLead(lead(bad)), { name: "ValidationError" });
  });

  test("trims the name and normalises the phone", () => {
    const valid = validateLead(lead({ name: "  Rafi  ", phone: "+8801711000001" }));
    assert.equal(valid.name, "Rafi");
    assert.equal(valid.phone, "01711000001");
  });
});

test("flags and stats describe what a person must check", () => {
  assert.deepEqual(flags(lead({ phone: "", program: "Unspecified" })), ["Missing phone", "Clarify programme"]);
  assert.deepEqual(flags(lead({ route: "Support" })), ["Human review"]);
  const summary = stats([lead({ messages: [{}, {}] }), lead({ route: "Support", messages: [{}] })], NOW);
  assert.deepEqual(summary, { total: 2, sales: 1, overdue: 2, support: 1, messages: 3 });
});
