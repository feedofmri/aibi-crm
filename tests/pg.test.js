import test from "node:test";
import assert from "node:assert/strict";
import { createPgStore } from "../lib/pgstore.js";
import { hashPassword, comparePassword, createToken, verifyToken } from "../lib/auth.js";
import { createApp } from "../server.js";

const PG_URL = process.env.DATABASE_URL || "postgresql://boraq:boraq_dev_password@127.0.0.1:5432/biai_crm";

test("PostgreSQL store and Auth functionality", async () => {
  let store;
  try {
    store = await createPgStore(PG_URL);
    assert.equal(store.isPg, true);

    // 1. Check default seeded users
    const users = await store.listUsers();
    assert.ok(users.length >= 4);
    const admin = await store.findUserByEmail("admin@biai.com.bd");
    assert.ok(admin);
    assert.equal(admin.role, "Admin");

    // 2. Test password verification
    const passMatch = await comparePassword("Admin123!", admin.password_hash);
    assert.equal(passMatch, true);
    const passMismatch = await comparePassword("WrongPassword", admin.password_hash);
    assert.equal(passMismatch, false);

    // 3. Test JWT token signing and verification
    const token = createToken({ id: admin.id, email: admin.email, role: admin.role, name: admin.name });
    assert.ok(token);
    const decoded = verifyToken(token);
    assert.equal(decoded.email, "admin@biai.com.bd");
    assert.equal(decoded.role, "Admin");
    assert.equal(verifyToken("invalid.token.here"), null);

    // 4. Test Lead persistence in PostgreSQL
    const testPhone = "01999888777";
    const added = await store.add({
      name: "PG Test Lead",
      phone: testPhone,
      message: "Testing PostgreSQL lead storage",
      channel: "WhatsApp",
      program: "Bootcamp",
      route: "Sales",
      language: "English",
      reply: "Thank you for reaching out to BIAI.",
      reason: "PostgreSQL test verification",
      mode: "manual",
    }, "Admin User");

    assert.ok(added.lead.id);
    assert.equal(added.lead.name, "PG Test Lead");
    assert.equal(added.lead.phone, testPhone);
    assert.equal(added.lead.messages.length, 1);
    assert.equal(added.lead.audit[0].author, "Admin User");

    // 5. Test update and delete in PostgreSQL
    added.lead.status = "Contacted";
    const updated = await store.write(added.lead);
    assert.equal(updated.status, "Contacted");

    await store.remove(added.lead.id);
    const deleted = await store.get(added.lead.id);
    assert.equal(deleted, null);
  } finally {
    if (store) await store.close();
  }
});

test("HTTP Auth API endpoints with PostgreSQL", async () => {
  let store;
  let server;
  try {
    store = await createPgStore(PG_URL);
    server = createApp(store, store);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = "http://127.0.0.1:" + server.address().port;

    // Login test
    const loginRes = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@biai.com.bd", password: "Admin123!" }),
    });
    assert.equal(loginRes.status, 200);
    const loginData = await loginRes.json();
    assert.ok(loginData.token);
    assert.equal(loginData.user.email, "admin@biai.com.bd");
    assert.equal(loginData.user.role, "Admin");

    // Verify /api/auth/me
    const meRes = await fetch(`${base}/api/auth/me`, {
      headers: { Authorization: `Bearer ${loginData.token}` },
    });
    assert.equal(meRes.status, 200);
    const meData = await meRes.json();
    assert.equal(meData.user.email, "admin@biai.com.bd");

    // Verify /api/auth/users
    const usersRes = await fetch(`${base}/api/auth/users`);
    assert.equal(usersRes.status, 200);
    const usersData = await usersRes.json();
    assert.ok(Array.isArray(usersData.users));
    assert.ok(usersData.users.length >= 4);

    // Verify state returns db info
    const stateRes = await fetch(`${base}/api/state`);
    assert.equal(stateRes.status, 200);
    const stateData = await stateRes.json();
    assert.equal(stateData.isPg, true);
    assert.match(stateData.db, /PostgreSQL/);

    // Clean up any lingering test lead from previous aborted run
    const existingTestLead = (await store.all()).find(l => l.phone === "01755123456");
    if (existingTestLead) await store.remove(existingTestLead.id);

    // Verify Inbound Simulator endpoint
    const simRes1 = await fetch(`${base}/api/simulator/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: "WhatsApp",
        name: "Farhan Kabir",
        phone: "01755123456",
        message: "Bootcamp er fee koto? Payment schedule kivabe kaj kore?",
      }),
    });
    assert.equal(simRes1.status, 200);
    const simData1 = await simRes1.json();
    assert.equal(simData1.success, true);
    assert.equal(simData1.isNewLead, true);
    assert.equal(simData1.lead.program, "Bootcamp");
    assert.equal(simData1.lead.route, "Sales");
    assert.ok(simData1.reply);

    // Send repeat message from same phone -> appends to thread
    const simRes2 = await fetch(`${base}/api/simulator/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: "WhatsApp",
        name: "Farhan Kabir",
        phone: "01755123456",
        message: "Payment link ta pathaben please.",
      }),
    });
    assert.equal(simRes2.status, 200);
    const simData2 = await simRes2.json();
    assert.equal(simData2.success, true);
    assert.equal(simData2.isNewLead, false);
    assert.equal(simData2.lead.messages.length, 2);

    // Clean up test lead
    await store.remove(simData1.lead.id);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (store) await store.close();
  }
});

