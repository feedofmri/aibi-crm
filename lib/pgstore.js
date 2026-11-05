import pg from "pg";
import { randomUUID } from "node:crypto";
import { normalizePhone, validateLead } from "./domain.js";
import { samples, sampleAnalysis } from "./samples.js";
import { hashPassword, comparePassword } from "./auth.js";

const { Pool } = pg;

export async function createPgStore(connectionString) {
  const pool = new Pool({
    connectionString:
      connectionString ||
      process.env.DATABASE_URL ||
      "postgresql://boraq:boraq_dev_password@127.0.0.1:5432/biai_crm",
  });

  // Initialize tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(64) NOT NULL DEFAULT 'Admissions',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS leads (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(64),
      program VARCHAR(64) NOT NULL DEFAULT 'Unspecified',
      route VARCHAR(64) NOT NULL DEFAULT 'Sales',
      language VARCHAR(64) NOT NULL DEFAULT 'English',
      status VARCHAR(64) NOT NULL DEFAULT 'New',
      owner VARCHAR(255) DEFAULT '',
      notes TEXT DEFAULT '',
      next_follow_up TIMESTAMPTZ,
      last_contact_at TIMESTAMPTZ,
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      draft TEXT DEFAULT '',
      draft_mode VARCHAR(64) DEFAULT 'manual',
      support_status VARCHAR(64) DEFAULT 'Open',
      priority VARCHAR(64) DEFAULT 'Normal',
      next_action TEXT DEFAULT '',
      analysis_reason TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS messages (
      id VARCHAR(64) PRIMARY KEY,
      lead_id VARCHAR(64) NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      channel VARCHAR(64) NOT NULL,
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      source_id VARCHAR(64),
      sender VARCHAR(255),
      phone VARCHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      lead_id VARCHAR(64) NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      author VARCHAR(255) DEFAULT 'System',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS settings (
      id VARCHAR(64) PRIMARY KEY,
      body JSONB NOT NULL
    );

    CREATE TABLE IF NOT EXISTS automation_jobs (
      id VARCHAR(64) PRIMARY KEY,
      body JSONB NOT NULL
    );
  `);

  // Earlier versions seeded staff accounts with "Biai2026!"; align them.
  {
    const { rows } = await pool.query(
      "SELECT email, password_hash FROM users WHERE email = ANY($1)",
      [["tanvir@biai.com.bd", "ayesha@biai.com.bd", "rahim@biai.com.bd"]],
    );
    for (const r of rows)
      if (await comparePassword("Biai2026!", r.password_hash))
        await pool.query("UPDATE users SET password_hash=$1 WHERE email=$2", [
          await hashPassword("Admin123!"),
          r.email,
        ]);
  }

  // Seed default admin and team users if empty
  const userCountRes = await pool.query("SELECT COUNT(*) FROM users");
  if (parseInt(userCountRes.rows[0].count, 10) === 0) {
    const adminHash = await hashPassword("Admin123!");
    const staffHash = adminHash; // all demo accounts use "Admin123!"
    await pool.query(
      `INSERT INTO users (id, name, email, password_hash, role) VALUES
       ($1, $2, $3, $4, $5),
       ($6, $7, $8, $9, $10),
       ($11, $12, $13, $14, $15),
       ($16, $17, $18, $19, $20)`,
      [
        randomUUID(), "Admin BIAI", "admin@biai.com.bd", adminHash, "Admin",
        randomUUID(), "Tanvir Ahmed", "tanvir@biai.com.bd", staffHash, "Admissions",
        randomUUID(), "Ayesha Siddiqua", "ayesha@biai.com.bd", staffHash, "Support",
        randomUUID(), "Rahim Chowdhury", "rahim@biai.com.bd", staffHash, "Sales",
      ]
    );
  }

  // User management helpers
  const findUserByEmail = async (email) => {
    const res = await pool.query(
      "SELECT id, name, email, password_hash, role, created_at FROM users WHERE LOWER(email) = LOWER($1)",
      [email.trim()]
    );
    const u = res.rows[0];
    if (!u) return null;
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      passwordHash: u.password_hash,
      password_hash: u.password_hash,
      role: u.role,
      createdAt: u.created_at,
    };
  };

  const findUserById = async (id) => {
    const res = await pool.query(
      "SELECT id, name, email, role, created_at FROM users WHERE id = $1",
      [id]
    );
    return res.rows[0] || null;
  };

  const listUsers = async () => {
    const res = await pool.query(
      "SELECT id, name, email, role, created_at FROM users ORDER BY name ASC"
    );
    return res.rows;
  };

  const createUser = async ({ name, email, password, passwordHash, role = "Admissions" }) => {
    const existing = await findUserByEmail(email);
    if (existing) throw new Error("A user with this email already exists.");
    const id = randomUUID();
    const hash = passwordHash || (await hashPassword(password));
    await pool.query(
      "INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)",
      [id, name.trim(), email.trim().toLowerCase(), hash, role]
    );
    return { id, name: name.trim(), email: email.trim().toLowerCase(), role };
  };

  // Helper to format lead row from DB to domain format
  function formatLead(leadRow, messagesRows = [], auditRows = []) {
    return {
      id: leadRow.id,
      name: leadRow.name,
      phone: leadRow.phone || "",
      program: leadRow.program,
      route: leadRow.route,
      language: leadRow.language,
      status: leadRow.status,
      owner: leadRow.owner || "",
      notes: leadRow.notes || "",
      nextFollowUp: leadRow.next_follow_up
        ? new Date(leadRow.next_follow_up).toISOString()
        : "",
      lastContactAt: leadRow.last_contact_at
        ? new Date(leadRow.last_contact_at).toISOString()
        : "",
      receivedAt: new Date(leadRow.received_at).toISOString(),
      draft: leadRow.draft || "",
      draftMode: leadRow.draft_mode || "manual",
      supportStatus: leadRow.support_status || "Open",
      priority: leadRow.priority || "Normal",
      nextAction: leadRow.next_action || "",
      analysisReason: leadRow.analysis_reason || "",
      messages: messagesRows.map((m) => ({
        id: m.id,
        text: m.text,
        channel: m.channel,
        receivedAt: new Date(m.received_at).toISOString(),
        sourceId: m.source_id,
        sender: m.sender || "",
        phone: m.phone || "",
      })),
      audit: auditRows.map((a) => ({
        at: new Date(a.created_at).toISOString(),
        action: a.action,
        author: a.author || "System",
      })),
    };
  }

  // Leads CRUD
  const all = async () => {
    const leadsRes = await pool.query(
      "SELECT * FROM leads ORDER BY created_at ASC"
    );
    if (!leadsRes.rows.length) return [];

    const messagesRes = await pool.query(
      "SELECT * FROM messages ORDER BY received_at ASC"
    );
    const auditRes = await pool.query(
      "SELECT * FROM audit_logs ORDER BY created_at ASC"
    );

    const messagesByLead = new Map();
    for (const m of messagesRes.rows) {
      if (!messagesByLead.has(m.lead_id)) messagesByLead.set(m.lead_id, []);
      messagesByLead.get(m.lead_id).push(m);
    }

    const auditByLead = new Map();
    for (const a of auditRes.rows) {
      if (!auditByLead.has(a.lead_id)) auditByLead.set(a.lead_id, []);
      auditByLead.get(a.lead_id).push(a);
    }

    return leadsRes.rows.map((row) =>
      formatLead(row, messagesByLead.get(row.id) || [], auditByLead.get(row.id) || [])
    );
  };

  const get = async (id) => {
    const leadRes = await pool.query("SELECT * FROM leads WHERE id = $1", [id]);
    if (!leadRes.rows.length) return null;

    const messagesRes = await pool.query(
      "SELECT * FROM messages WHERE lead_id = $1 ORDER BY received_at ASC",
      [id]
    );
    const auditRes = await pool.query(
      "SELECT * FROM audit_logs WHERE lead_id = $1 ORDER BY created_at ASC",
      [id]
    );

    return formatLead(leadRes.rows[0], messagesRes.rows, auditRes.rows);
  };

  const write = async (lead) => {
    await pool.query(
      `UPDATE leads SET
        name = $1, phone = $2, program = $3, route = $4, language = $5,
        status = $6, owner = $7, notes = $8, next_follow_up = $9,
        last_contact_at = $10, draft = $11, draft_mode = $12,
        support_status = $13, priority = $14, next_action = $15,
        analysis_reason = $16, updated_at = NOW()
       WHERE id = $17`,
      [
        lead.name,
        lead.phone || "",
        lead.program,
        lead.route,
        lead.language,
        lead.status,
        lead.owner || "",
        lead.notes || "",
        lead.nextFollowUp ? new Date(lead.nextFollowUp) : null,
        lead.lastContactAt ? new Date(lead.lastContactAt) : null,
        lead.draft || "",
        lead.draftMode || "manual",
        lead.supportStatus || "Open",
        lead.priority || "Normal",
        lead.nextAction || "",
        lead.analysisReason || "",
        lead.id,
      ]
    );

    // Sync latest audit entry if newly added
    if (lead.audit && lead.audit.length) {
      const latest = lead.audit[lead.audit.length - 1];
      const checkAudit = await pool.query(
        "SELECT id FROM audit_logs WHERE lead_id = $1 AND action = $2 ORDER BY id DESC LIMIT 1",
        [lead.id, latest.action]
      );
      if (!checkAudit.rows.length) {
        await pool.query(
          "INSERT INTO audit_logs (lead_id, action, author, created_at) VALUES ($1, $2, $3, $4)",
          [lead.id, latest.action, latest.author || "System", latest.at ? new Date(latest.at) : new Date()]
        );
      }
    }

    return get(lead.id);
  };

  const remove = async (id) => {
    await pool.query("DELETE FROM leads WHERE id = $1", [id]);
    return { id };
  };

  const add = async (input, author = "System") => {
    const existingLeads = await all();
    const repeated = input.sourceId
      ? existingLeads.find((l) =>
          l.messages.some((m) => m.sourceId === input.sourceId)
        )
      : null;
    const phone = normalizePhone(input.phone || "");
    const existing =
      repeated || (phone ? existingLeads.find((l) => l.phone === phone) : null);
    const stamp = input.receivedAt || new Date().toISOString();
    const msgId = randomUUID();

    if (existing) {
      const duplicate = existing.messages.some(
        (m) =>
          (input.sourceId && m.sourceId === input.sourceId) ||
          (m.text === input.message &&
            m.receivedAt === stamp &&
            m.channel === input.channel)
      );

      if (input.applyReview) {
        if (
          phone &&
          existingLeads.some((l) => l.id !== existing.id && l.phone === phone)
        ) {
          throw new Error(
            "That phone belongs to a different contact. Review the identity before saving."
          );
        }
        for (const key of ["name", "phone", "program", "route", "language"]) {
          existing[key] = input[key];
        }
        existing.phone = phone;
        existing.draft = input.reply || "";
        existing.draftMode = input.mode || "manual";
        existing.analysisReason = input.reason || "";
        existing.audit.push({
          at: new Date().toISOString(),
          action: "Saved human-reviewed intake details and reply",
          author,
        });
      }

      if (duplicate) {
        const updated = await write(existing);
        return { lead: updated, merged: true, duplicate: true, updated: true };
      }

      // Add new message to existing lead
      await pool.query(
        `INSERT INTO messages (id, lead_id, text, channel, received_at, source_id, sender, phone)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          msgId,
          existing.id,
          input.message,
          input.channel,
          new Date(stamp),
          input.sourceId || null,
          input.name || existing.name,
          phone,
        ]
      );

      if (existing.route === "Support") existing.supportStatus = "Open";
      existing.receivedAt = [existing.receivedAt, stamp].sort().at(-1);
      existing.audit.push({
        at: new Date().toISOString(),
        action: "Added enquiry to existing contact",
        author,
      });

      const updated = await write(existing);
      return { lead: updated, merged: true, updated: true };
    }

    // Create brand new lead
    const valid = validateLead({
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
      messages: [],
      draft: input.reply || "",
      draftMode: input.mode || "manual",
      audit: [],
    });

    const leadId = valid.id;
    const isUrgent = input.sourceId === "16";

    await pool.query(
      `INSERT INTO leads (
        id, name, phone, program, route, language, status, owner, notes,
        next_follow_up, last_contact_at, received_at, draft, draft_mode,
        support_status, priority, next_action, analysis_reason
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
      [
        leadId,
        valid.name,
        valid.phone,
        valid.program,
        valid.route,
        valid.language,
        valid.status,
        valid.owner,
        valid.notes,
        null,
        null,
        new Date(stamp),
        valid.draft,
        valid.draftMode,
        "Open",
        isUrgent ? "Urgent" : "Normal",
        "",
        input.reason || "",
      ]
    );

    // Insert original message
    await pool.query(
      `INSERT INTO messages (id, lead_id, text, channel, received_at, source_id, sender, phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        msgId,
        leadId,
        input.message,
        input.channel,
        new Date(stamp),
        input.sourceId || null,
        valid.name,
        valid.phone,
      ]
    );

    // Insert creation audit log
    await pool.query(
      `INSERT INTO audit_logs (lead_id, action, author, created_at)
       VALUES ($1, $2, $3, $4)`,
      [
        leadId,
        "Created from " + (input.mode || "manual") + " intake",
        author,
        new Date(),
      ]
    );

    const createdLead = await get(leadId);
    return { lead: createdLead, merged: false };
  };

  const seed = async () => {
    for (const row of samples) {
      await add({
        ...sampleAnalysis(row),
        message: row.message,
        channel: row.channel,
        receivedAt: row["received at"].replace(" ", "T") + ":00+06:00",
        sourceId: row.id,
      });
    }
  };

  // Seed samples if leads table is empty
  const leadCountRes = await pool.query("SELECT COUNT(*) FROM leads");
  if (parseInt(leadCountRes.rows[0].count, 10) === 0) {
    await seed();
  }

  // Automation jobs & settings
  const jobs = async () => {
    const res = await pool.query(
      "SELECT body FROM automation_jobs ORDER BY (body->>'createdAt') DESC"
    );
    return res.rows.map((r) => r.body);
  };

  const saveJob = async (job) => {
    await pool.query(
      `INSERT INTO automation_jobs (id, body) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET body = EXCLUDED.body`,
      [job.id, JSON.stringify(job)]
    );
    return job;
  };

  const settings = async () => {
    const res = await pool.query("SELECT body FROM settings WHERE id = 'automation'");
    return res.rows[0]?.body || { mode: "manual" };
  };

  const saveSettings = async (value) => {
    if (!["manual", "automatic"].includes(value.mode)) {
      throw new Error("Invalid processing mode.");
    }
    const val = { mode: value.mode };
    await pool.query(
      `INSERT INTO settings (id, body) VALUES ('automation', $1)
       ON CONFLICT (id) DO UPDATE SET body = EXCLUDED.body`,
      [JSON.stringify(val)]
    );
    return val;
  };

  return {
    isPg: true,
    all,
    get,
    add,
    write,
    remove,
    seed,
    jobs,
    saveJob,
    settings,
    saveSettings,
    findUserByEmail,
    findUserById,
    listUsers,
    createUser,
    close: () => pool.end(),
  };
}
