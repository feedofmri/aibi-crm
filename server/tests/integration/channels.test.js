import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { databaseUnavailable, startTestApp } from "../helpers/test-app.js";

const skip = await databaseUnavailable();
const KEY = { "X-Channel-Key": "dev-channel-key" };
const SIMULATOR_ORIGIN = "http://localhost:5174";

describe("inbound channel API (channel simulator site)", { skip }, () => {
  let app;
  before(async () => {
    app = await startTestApp();
  });
  after(() => app?.close());

  test("requires the channel key, not a staff session", async () => {
    const client = app.client();
    const body = { message: "Fellowship kobe shuru?", channel: "WhatsApp" };
    assert.equal((await client.post("/api/channels/inbound", body)).status, 401);
    assert.equal((await client.post("/api/channels/inbound", body, { "X-Channel-Key": "wrong" })).status, 401);
    assert.equal((await client.get("/api/channels/info", KEY)).status, 200);

    // A staff session alone does not grant channel access.
    const admin = await app.signIn();
    assert.equal((await admin.post("/api/channels/inbound", body)).status, 401);
  });

  test("allows CORS only for the simulator's origin", async () => {
    const res = await fetch(`${app.baseUrl}/api/channels/inbound`, {
      method: "OPTIONS",
      headers: { Origin: SIMULATOR_ORIGIN, "Access-Control-Request-Method": "POST" },
    });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get("access-control-allow-origin"), SIMULATOR_ORIGIN);
    assert.match(res.headers.get("access-control-allow-headers"), /X-Channel-Key/);

    const other = await fetch(`${app.baseUrl}/api/channels/info`, { headers: { Origin: "https://evil.example", ...KEY } });
    assert.equal(other.headers.get("access-control-allow-origin"), null);
  });

  test("an inbound message is saved like a real enquiry and returns only a summary", async () => {
    const client = app.client();
    const res = await client.post(
      "/api/channels/inbound",
      { message: "Fellowship kobe shuru?", channel: "WhatsApp", name: "Nadia", phone: "01912345678" },
      KEY,
    );
    assert.equal(res.status, 201);
    assert.equal(res.body.created, true);
    assert.equal(res.body.contact.program, "Fellowship");
    assert.match(res.body.contact.crmUrl, /\/enquiries\?contact=/);
    assert.equal(res.body.contact.activity, undefined, "no internal CRM history is exposed");
    assert.ok(res.body.reply);

    const again = await client.post("/api/channels/inbound", { message: "Any update?", channel: "WhatsApp", phone: "01912345678" }, KEY);
    assert.equal(again.status, 200);
    assert.equal(again.body.contact.id, res.body.contact.id);
    assert.equal(again.body.contact.messages, 2);

    const admin = await app.signIn();
    const lead = (await admin.get(`/api/leads/${res.body.contact.id}`)).body.lead;
    assert.match(lead.activity[0].author, /Channel simulator/);
  });
});
