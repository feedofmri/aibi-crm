import pg from "pg";
import { config } from "../config/env.js";

// Return DATE/TIMESTAMPTZ as ISO strings via JS Date; keep NUMERIC/BIGINT counts as numbers.
pg.types.setTypeParser(20, (v) => Number(v));

export function createPool(connectionString = config.databaseUrl) {
  const pool = new pg.Pool({ connectionString, max: 10 });
  pool.on("error", (err) => console.error("[db] idle client error:", err.message));
  return pool;
}

/** Run `fn` inside a transaction, committing on success and rolling back on error. */
export async function withTransaction(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
