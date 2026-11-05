import { config } from "./config/env.js";
import { createPool } from "./db/pool.js";
import { migrate } from "./db/migrate.js";
import { seedSampleLeads, seedUsers } from "./db/seed.js";
import { createApp, createServices } from "./app.js";

async function main() {
  const pool = createPool();
  try {
    await pool.query("SELECT 1");
  } catch (error) {
    console.error(
      `[db] Cannot connect to PostgreSQL (${error.message}).\n` +
        "     Start it with `npm run db:up` (Docker) or set DATABASE_URL in .env.",
    );
    process.exit(1);
  }

  await migrate(pool, { log: console.log });
  const services = createServices({ pool });
  await services.automationService.recover();
  const users = await seedUsers(pool);
  const leads = await seedSampleLeads(pool, services.leadsService);
  if (users) console.log(`[db] seeded ${users} demo team accounts`);
  if (leads) console.log(`[db] imported ${leads} sample enquiries`);
  if (config.usingDevSecret) console.warn("[auth] JWT_SECRET is not set; using a development-only secret.");

  const app = createApp(services);
  const server = app.listen(config.port, config.host, () => {
    const ai = services.ai.liveEnabled() ? `live AI (${services.ai.aiConfig().provider})` : "rule-based AI fallback";
    console.log(`[api] BIAI CRM listening on http://${config.host}:${config.port} · ${ai}`);
  });

  const shutdown = (signal) => {
    console.log(`[api] ${signal} received, shutting down`);
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
