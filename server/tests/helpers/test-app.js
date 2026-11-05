import "./env.js";
import pg from "pg";
import { createApp, createServices } from "../../src/app.js";
import { migrate } from "../../src/db/migrate.js";
import { seedSampleLeads, seedUsers } from "../../src/db/seed.js";
import * as realAi from "../../src/services/ai/ai.service.js";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL || "postgresql://biai:biai_dev_password@127.0.0.1:5432/biai_crm_test";

/** Skip reason when no test database is reachable (so `npm test` still runs the unit tests). */
export async function databaseUnavailable() {
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  try {
    await client.connect();
    await client.end();
    return false;
  } catch (error) {
    return `PostgreSQL test database not reachable (${error.message}). Set TEST_DATABASE_URL.`;
  }
}

/**
 * Start the real app on a random port against a freshly migrated and seeded
 * test database. `ai` can override AI functions (e.g. a fake live analyzer).
 */
export async function startTestApp({ ai = {}, seed = true } = {}) {
  const pool = new pg.Pool({ connectionString: TEST_DATABASE_URL, max: 5 });
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await migrate(pool);
  const services = createServices({ pool, ai: { ...realAi, ...ai } });
  await seedUsers(pool);
  if (seed) await seedSampleLeads(pool, services.leadsService);

  const server = createApp(services, { serveClient: false }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  return {
    pool,
    services,
    baseUrl,
    client: () => createClient(baseUrl),
    async signIn(email = "admin@biai.com.bd", password = "Admin123!") {
      const client = createClient(baseUrl);
      const res = await client.post("/api/auth/login", { email, password });
      if (res.status !== 200) throw new Error(`Sign-in failed: ${res.status}`);
      return client;
    },
    async close() {
      await new Promise((resolve) => server.close(resolve));
      await pool.end();
    },
  };
}

/** Minimal HTTP client that keeps the session cookie like a browser would. */
function createClient(baseUrl) {
  let cookie = "";
  async function request(method, path, body, headers = {}) {
    const res = await fetch(baseUrl + path, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    const text = await res.text();
    return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
  }
  return {
    get: (path, headers) => request("GET", path, undefined, headers),
    post: (path, body, headers) => request("POST", path, body ?? {}, headers),
    put: (path, body) => request("PUT", path, body),
    patch: (path, body) => request("PATCH", path, body),
    delete: (path) => request("DELETE", path),
  };
}
