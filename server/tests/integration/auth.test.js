import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { databaseUnavailable, startTestApp } from "../helpers/test-app.js";

const skip = await databaseUnavailable();

describe("authentication and roles", { skip }, () => {
  let app;
  before(async () => {
    app = await startTestApp();
  });
  after(() => app?.close());

  test("every CRM endpoint requires a session", async () => {
    const anonymous = app.client();
    for (const path of ["/api/leads", "/api/meta", "/api/users", "/api/automation", "/api/reports/weekly?end=2026-11-01"]) {
      const res = await anonymous.get(path);
      assert.equal(res.status, 401, path);
    }
    assert.equal((await anonymous.get("/api/health")).status, 200);
  });

  test("sign-in sets an httpOnly session cookie and never returns the password hash", async () => {
    const client = app.client();
    const wrong = await client.post("/api/auth/login", { email: "admin@biai.com.bd", password: "nope" });
    assert.equal(wrong.status, 401);

    const res = await client.post("/api/auth/login", { email: "ADMIN@biai.com.bd", password: "Admin123!" });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.role, "Admin");
    assert.equal(res.body.user.passwordHash, undefined);
    const cookie = res.headers.get("set-cookie");
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);

    assert.equal((await client.get("/api/auth/me")).body.user.email, "admin@biai.com.bd");
    assert.equal((await client.post("/api/auth/logout")).status, 204);
  });

  test("only admins add team members or delete contacts", async () => {
    const sales = await app.signIn("rahim@biai.com.bd");
    const member = { name: "New Person", email: "new@biai.com.bd", password: "longenough", role: "Sales" };
    assert.equal((await sales.post("/api/users", member)).status, 403);

    const leadId = (await sales.get("/api/leads")).body.leads[0].id;
    assert.equal((await sales.delete(`/api/leads/${leadId}`)).status, 403);

    const admin = await app.signIn();
    const created = await admin.post("/api/users", member);
    assert.equal(created.status, 201);
    assert.equal((await admin.post("/api/users", member)).status, 409);
    assert.equal((await admin.post("/api/users", { ...member, email: "x@biai.com.bd", password: "short" })).status, 400);
    assert.equal((await app.signIn("new@biai.com.bd", "longenough")).constructor, Object);
  });

  test("cross-site state changes are refused", async () => {
    const admin = await app.signIn();
    const leadId = (await admin.get("/api/leads")).body.leads[0].id;
    const res = await admin.post(`/api/leads/${leadId}/contact`, {}, { Origin: "https://evil.example" });
    assert.equal(res.status, 403);
  });
});
