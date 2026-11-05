/**
 * Data access for leads, their original messages and activity history.
 * Every function takes `db` (a pool or a transaction client) as the first
 * argument so services decide transaction boundaries.
 */

const iso = (value) => (value ? new Date(value).toISOString() : "");

function mapLead(row, messages = [], activity = []) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    program: row.program,
    route: row.route,
    language: row.language,
    status: row.status,
    supportStatus: row.support_status,
    priority: row.priority,
    owner: row.owner,
    notes: row.notes,
    nextAction: row.next_action,
    nextFollowUp: iso(row.next_follow_up),
    lastContactAt: iso(row.last_contact_at),
    receivedAt: iso(row.received_at),
    draft: row.draft,
    draftMode: row.draft_mode,
    analysisReason: row.analysis_reason,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    messages: messages.map((m) => ({
      id: m.id,
      text: m.text,
      channel: m.channel,
      receivedAt: iso(m.received_at),
      sourceId: m.source_id || "",
      sender: m.sender,
      phone: m.phone,
      direction: m.direction || "inbound",
      author: m.author || "",
      delivery: m.delivery || "",
    })),
    activity: activity.map((a) => ({
      id: Number(a.id),
      action: a.action,
      author: a.author,
      at: iso(a.created_at),
    })),
  };
}

function groupBy(rows, key) {
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row[key])) map.set(row[key], []);
    map.get(row[key]).push(row);
  }
  return map;
}

export async function findAll(db) {
  const [leads, messages, activity] = await Promise.all([
    db.query("SELECT * FROM leads ORDER BY received_at DESC, created_at DESC"),
    db.query("SELECT * FROM messages ORDER BY received_at ASC, created_at ASC"),
    db.query("SELECT * FROM activity_log ORDER BY created_at ASC, id ASC"),
  ]);
  const messagesByLead = groupBy(messages.rows, "lead_id");
  const activityByLead = groupBy(activity.rows, "lead_id");
  return leads.rows.map((row) =>
    mapLead(row, messagesByLead.get(row.id), activityByLead.get(row.id)),
  );
}

export async function findById(db, id) {
  const { rows } = await db.query("SELECT * FROM leads WHERE id = $1", [id]);
  if (!rows[0]) return null;
  const messages = await db.query(
    "SELECT * FROM messages WHERE lead_id = $1 ORDER BY received_at, created_at",
    [id],
  );
  const activity = await db.query(
    "SELECT * FROM activity_log WHERE lead_id = $1 ORDER BY created_at, id",
    [id],
  );
  return mapLead(rows[0], messages.rows, activity.rows);
}

export async function findIdByPhone(db, phone, { excludeId } = {}) {
  if (!phone) return null;
  const { rows } = await db.query(
    "SELECT id FROM leads WHERE phone = $1 AND ($2::uuid IS NULL OR id <> $2::uuid) LIMIT 1",
    [phone, excludeId || null],
  );
  return rows[0]?.id || null;
}

export async function findIdBySourceId(db, sourceId) {
  if (!sourceId) return null;
  const { rows } = await db.query("SELECT lead_id FROM messages WHERE source_id = $1", [sourceId]);
  return rows[0]?.lead_id || null;
}

/** True when this exact message (same source id, or same text/channel/time) is already stored. */
export async function hasMessage(db, leadId, { sourceId, text, channel, receivedAt }) {
  const { rows } = await db.query(
    `SELECT 1 FROM messages
      WHERE lead_id = $1
        AND direction = 'inbound'
        AND (($2::text IS NOT NULL AND source_id = $2)
             OR (text = $3 AND channel = $4 AND received_at = $5::timestamptz))
      LIMIT 1`,
    [leadId, sourceId || null, text, channel, receivedAt],
  );
  return rows.length > 0;
}

const COLUMNS = {
  name: "name",
  phone: "phone",
  program: "program",
  route: "route",
  language: "language",
  status: "status",
  supportStatus: "support_status",
  priority: "priority",
  owner: "owner",
  notes: "notes",
  nextAction: "next_action",
  nextFollowUp: "next_follow_up",
  lastContactAt: "last_contact_at",
  receivedAt: "received_at",
  draft: "draft",
  draftMode: "draft_mode",
  analysisReason: "analysis_reason",
};

const TIMESTAMP_FIELDS = new Set(["nextFollowUp", "lastContactAt", "receivedAt"]);
const toDbValue = (key, value) => (TIMESTAMP_FIELDS.has(key) ? value || null : value);

export async function insertLead(db, lead) {
  const keys = Object.keys(COLUMNS).filter((k) => lead[k] !== undefined);
  const { rows } = await db.query(
    `INSERT INTO leads (${keys.map((k) => COLUMNS[k]).join(", ")})
     VALUES (${keys.map((_, i) => `$${i + 1}`).join(", ")})
     RETURNING id`,
    keys.map((k) => toDbValue(k, lead[k])),
  );
  return rows[0].id;
}

export async function updateLead(db, id, changes) {
  const keys = Object.keys(changes).filter((k) => COLUMNS[k]);
  if (!keys.length) return;
  await db.query(
    `UPDATE leads SET ${keys.map((k, i) => `${COLUMNS[k]} = $${i + 2}`).join(", ")}, updated_at = now()
     WHERE id = $1`,
    [id, ...keys.map((k) => toDbValue(k, changes[k]))],
  );
}

export async function insertMessage(
  db,
  leadId,
  { text, channel, receivedAt, sourceId, sender, phone, direction = "inbound", author = "", delivery = "" },
) {
  await db.query(
    `INSERT INTO messages (lead_id, text, channel, received_at, source_id, sender, phone, direction, author, delivery)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [leadId, text, channel, receivedAt, sourceId || null, sender || "", phone || "", direction, author, delivery],
  );
}

export async function addActivity(db, leadId, action, author = "System") {
  await db.query("INSERT INTO activity_log (lead_id, action, author) VALUES ($1, $2, $3)", [
    leadId,
    action,
    author,
  ]);
}

export async function deleteLead(db, id) {
  const { rowCount } = await db.query("DELETE FROM leads WHERE id = $1", [id]);
  return rowCount > 0;
}

export async function count(db) {
  const { rows } = await db.query("SELECT count(*)::int AS n FROM leads");
  return rows[0].n;
}
