const toUser = (row) =>
  row && {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    createdAt: new Date(row.created_at).toISOString(),
  };

export async function findByEmail(db, email) {
  const { rows } = await db.query("SELECT * FROM users WHERE email = lower($1)", [email.trim()]);
  return rows[0] ? { ...toUser(rows[0]), passwordHash: rows[0].password_hash } : null;
}

export async function findById(db, id) {
  const { rows } = await db.query("SELECT * FROM users WHERE id = $1", [id]);
  return toUser(rows[0]) || null;
}

export async function list(db) {
  const { rows } = await db.query("SELECT * FROM users ORDER BY (role = 'Admin') DESC, name");
  return rows.map(toUser);
}

export async function insert(db, { name, email, passwordHash, role }) {
  const { rows } = await db.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, lower($2), $3, $4)
     ON CONFLICT (email) DO NOTHING
     RETURNING *`,
    [name.trim(), email.trim(), passwordHash, role],
  );
  return toUser(rows[0]) || null;
}

export async function count(db) {
  const { rows } = await db.query("SELECT count(*)::int AS n FROM users");
  return rows[0].n;
}
