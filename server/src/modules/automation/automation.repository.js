const iso = (v) => (v ? new Date(v).toISOString() : "");

const toJob = (row) =>
  row && {
    id: row.id,
    status: row.status,
    mode: row.mode,
    input: row.input,
    result: row.result,
    reasons: row.reasons,
    error: row.error,
    leadId: row.lead_id || "",
    createdAt: iso(row.created_at),
    completedAt: iso(row.completed_at),
  };

export async function list(db, { limit = 100 } = {}) {
  const { rows } = await db.query(
    "SELECT * FROM automation_jobs ORDER BY created_at DESC LIMIT $1",
    [limit],
  );
  return rows.map(toJob);
}

export async function findById(db, id) {
  const { rows } = await db.query("SELECT * FROM automation_jobs WHERE id = $1", [id]);
  return toJob(rows[0]) || null;
}

export async function findByKey(db, key) {
  const { rows } = await db.query("SELECT * FROM automation_jobs WHERE dedupe_key = $1", [key]);
  return toJob(rows[0]) || null;
}

/** Create the job or, for a failed job with the same key, reset it for a retry. */
export async function upsertProcessing(db, { key, mode, input }) {
  const { rows } = await db.query(
    `INSERT INTO automation_jobs (dedupe_key, status, mode, input)
     VALUES ($1, 'Processing', $2, $3)
     ON CONFLICT (dedupe_key) DO UPDATE
       SET status = 'Processing', mode = EXCLUDED.mode, error = ''
       WHERE automation_jobs.status = 'Failed'
     RETURNING *`,
    [key, mode, JSON.stringify(input)],
  );
  return toJob(rows[0]) || null;
}

export async function update(db, id, { status, result, reasons, error, leadId, completed }) {
  const { rows } = await db.query(
    `UPDATE automation_jobs SET
       status = COALESCE($2, status),
       result = COALESCE($3::jsonb, result),
       reasons = COALESCE($4::jsonb, reasons),
       error = COALESCE($5, error),
       lead_id = COALESCE($6::uuid, lead_id),
       completed_at = CASE WHEN $7 THEN now() ELSE completed_at END
     WHERE id = $1
     RETURNING *`,
    [
      id,
      status ?? null,
      result === undefined ? null : JSON.stringify(result),
      reasons === undefined ? null : JSON.stringify(reasons),
      error ?? null,
      leadId || null,
      Boolean(completed),
    ],
  );
  return toJob(rows[0]);
}

/** Jobs left in Processing by a crash or restart become retryable failures. */
export async function failInterrupted(db) {
  await db.query(
    `UPDATE automation_jobs SET status = 'Failed', error = 'Processing was interrupted. Retry this enquiry.'
     WHERE status = 'Processing'`,
  );
}

export async function getSettings(db) {
  const { rows } = await db.query("SELECT value FROM settings WHERE key = 'automation'");
  return { mode: "manual", autoReply: "off", ...(rows[0]?.value || {}) };
}

export async function saveSettings(db, value) {
  await db.query(
    `INSERT INTO settings (key, value) VALUES ('automation', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [JSON.stringify(value)],
  );
  return value;
}
