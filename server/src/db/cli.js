/**
 * Database maintenance commands:
 *   node src/db/cli.js migrate   apply pending migrations
 *   node src/db/cli.js seed      add demo accounts and sample enquiries if empty
 *   node src/db/cli.js reset     restore the 20 sample enquiries (keeps accounts)
 */
import { createServices } from "../app.js";
import { createPool } from "./pool.js";
import { migrate } from "./migrate.js";
import { resetDemoData, seedSampleLeads, seedUsers } from "./seed.js";

const command = process.argv[2];
const pool = createPool();

try {
  await migrate(pool, { log: console.log });
  const { leadsService } = createServices({ pool });
  if (command === "seed") {
    console.log(`users: ${await seedUsers(pool)}, enquiries: ${await seedSampleLeads(pool, leadsService)}`);
  } else if (command === "reset") {
    await seedUsers(pool);
    console.log(`re-imported ${await resetDemoData(pool, leadsService)} sample enquiries`);
  } else if (command !== "migrate") {
    console.error("Usage: node src/db/cli.js <migrate|seed|reset>");
    process.exitCode = 1;
  }
} finally {
  await pool.end();
}
