import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { normalizePhone, validateLead } from "./domain.js";
import { samples, sampleAnalysis } from "./samples.js";
export function createStore(path, { seedSamples = true } = {}) {
  const db = new DatabaseSync(path);
  db.exec(
    "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS leads (id TEXT PRIMARY KEY, body TEXT NOT NULL)",
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS automation_jobs (id TEXT PRIMARY KEY, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS settings (id TEXT PRIMARY KEY, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, created_at TEXT NOT NULL)",
  );
  const jobs = () =>
    db
      .prepare("SELECT body FROM automation_jobs ORDER BY rowid DESC")
      .all()
      .map((r) => JSON.parse(r.body));
  const saveJob = (job) => {
    db.prepare(
      "INSERT INTO automation_jobs VALUES (?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body",
    ).run(job.id, JSON.stringify(job));
    return job;
  };
  for (const job of jobs())
    if (job.status === "Processing") {
      job.status = "Failed";
      job.error = "Processing interrupted. Retry this enquiry.";
      saveJob(job);
    }
  const settings = () =>
    JSON.parse(
      db.prepare("SELECT body FROM settings WHERE id='automation'").get()
        ?.body || '{"mode":"manual"}',
    );
  const saveSettings = (value) => {
    if (!["manual", "automatic"].includes(value.mode))
      throw new Error("Invalid processing mode.");
    db.prepare(
      "INSERT INTO settings VALUES ('automation',?) ON CONFLICT(id) DO UPDATE SET body=excluded.body",
    ).run(JSON.stringify({ mode: value.mode }));
    return settings();
  };
  const all = () =>
    db
      .prepare("SELECT body FROM leads ORDER BY rowid")
      .all()
      .map((r) => JSON.parse(r.body));
  const get = (id) => {
    const r = db.prepare("SELECT body FROM leads WHERE id=?").get(id);
    return r ? JSON.parse(r.body) : null;
  };
  const write = (lead) => {
    db.prepare(
      "INSERT INTO leads(id,body) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body",
    ).run(lead.id, JSON.stringify(lead));
    return lead;
  };
  const remove = (id) => {
    db.prepare("DELETE FROM leads WHERE id=?").run(id);
    return { id };
  };
  function add(input) {
    const repeated = input.sourceId
      ? all().find((l) => l.messages.some((m) => m.sourceId === input.sourceId))
      : null;
    const phone = normalizePhone(input.phone || "");
    const existing =
      repeated || (phone ? all().find((l) => l.phone === phone) : null);
    const stamp = input.receivedAt || new Date().toISOString();
    const msg = {
      id: randomUUID(),
      text: input.message,
      channel: input.channel,
      receivedAt: stamp,
      sourceId: input.sourceId || null,
      sender: input.name,
      phone,
    };
    if (existing) {
      const duplicate = existing.messages.some(
        (m) =>
          (msg.sourceId && m.sourceId === msg.sourceId) ||
          (m.text === msg.text &&
            m.receivedAt === stamp &&
            m.channel === msg.channel),
      );
      if (input.applyReview) {
        if (
          phone &&
          all().some((l) => l.id !== existing.id && l.phone === phone)
        )
          throw new Error(
            "That phone belongs to a different contact. Review the identity before saving.",
          );
        for (const key of ["name", "phone", "program", "route", "language"])
          existing[key] = input[key];
        existing.phone = phone;
        existing.draft = input.reply || "";
        existing.draftMode = input.mode || "manual";
        existing.analysisReason = input.reason || "";
        existing.audit.push({
          at: new Date().toISOString(),
          action: "Saved human-reviewed intake details and reply",
        });
      }
      if (duplicate)
        return { lead: write(existing), merged: true, duplicate: true };
      existing.messages.push(msg);
      if (existing.route === "Support") existing.supportStatus = "Open";
      existing.receivedAt = [existing.receivedAt, stamp].sort().at(-1);
      existing.audit.push({
        at: new Date().toISOString(),
        action: "Added enquiry to existing phone contact",
      });
      return { lead: write(existing), merged: true };
    }
    const lead = validateLead({
      id: randomUUID(),
      name: input.name || "Unknown",
      phone,
      program: input.program || "Unspecified",
      route: input.route || "Sales",
      language: input.language || "English",
      status: "New",
      owner: "",
      notes: input.reason || "",
      nextFollowUp: "",
      lastContactAt: "",
      receivedAt: stamp,
      messages: [msg],
      draft: input.reply || "",
      draftMode: input.mode || "manual",
      audit: [
        {
          at: new Date().toISOString(),
          action: "Created from " + (input.mode || "manual") + " intake",
        },
      ],
    });
    lead.supportStatus = "Open";
    lead.priority = input.sourceId === "16" ? "Urgent" : "Normal";
    lead.nextAction = "";
    lead.analysisReason = input.reason || "";
    return { lead: write(lead), merged: false };
  }
  function seed() {
    db.exec("BEGIN");
    try {
      for (const row of samples)
        add({
          ...sampleAnalysis(row),
          message: row.message,
          channel: row.channel,
          receivedAt: row["received at"].replace(" ", "T") + ":00+06:00",
          sourceId: row.id,
        });
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  if (seedSamples && !all().length) seed();
  for (const lead of all())
    if (!lead.supportStatus) {
      lead.supportStatus = "Open";
      lead.priority = lead.messages.some((m) => m.sourceId === "16")
        ? "Urgent"
        : "Normal";
      lead.nextAction = "";
      write(lead);
    }
  const DEFAULT_HASH = "$2b$10$i4oVvEAxeItVxm0F23.9K.T0LE7A/8OdthXiMstw3iALvVNfegnX2"; // Biai@2026!
  const SEED_USERS = [
    { email: "admin@biai.com.bd", name: "Admin BIAI", role: "Admin", passwordHash: DEFAULT_HASH },
    { email: "tanvir@biai.com.bd", name: "Tanvir Ahmed", role: "Admissions", passwordHash: DEFAULT_HASH },
    { email: "ayesha@biai.com.bd", name: "Ayesha Siddiqua", role: "Support", passwordHash: DEFAULT_HASH },
    { email: "rahim@biai.com.bd", name: "Rahim Chowdhury", role: "Sales", passwordHash: DEFAULT_HASH },
  ];

  const findUserByEmail = (email) => {
    const row = db.prepare("SELECT * FROM users WHERE email=?").get(String(email || "").trim().toLowerCase());
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      name: row.name,
      role: row.role,
      createdAt: row.created_at,
    };
  };

  const createUser = ({ email, passwordHash, name, role }) => {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    db.prepare("INSERT INTO users (id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, normalizedEmail, passwordHash, name || normalizedEmail.split("@")[0], role || "Admissions", createdAt);
    return { id, email: normalizedEmail, name: name || normalizedEmail.split("@")[0], role: role || "Admissions", createdAt };
  };

  const listUsers = () => {
    return db.prepare("SELECT id, email, name, role, created_at FROM users ORDER BY name").all()
      .map(r => ({ id: r.id, email: r.email, name: r.name, role: r.role, createdAt: r.created_at }));
  };

  // Ensure default users are seeded
  for (const u of SEED_USERS) {
    if (!findUserByEmail(u.email)) {
      createUser(u);
    }
  }

  return {
    jobs,
    saveJob,
    settings,
    saveSettings,
    all,
    get,
    add,
    seed,
    write,
    remove,
    findUserByEmail,
    createUser,
    listUsers,
    close: () => db.close(),
  };
}
