import { config } from "../config/env.js";
import { hashPassword } from "../modules/auth/auth.service.js";
import * as users from "../modules/users/users.repository.js";
import * as leadsRepo from "../modules/leads/leads.repository.js";
import { samples, sampleAnalysis } from "../services/ai/samples.js";

/** Fictional demo team. All accounts use the documented demo password. */
export const DEMO_USERS = [
  { name: "Admin BIAI", email: "admin@biai.com.bd", role: "Admin" },
  { name: "Tanvir Ahmed", email: "tanvir@biai.com.bd", role: "Admissions" },
  { name: "Ayesha Siddiqua", email: "ayesha@biai.com.bd", role: "Support" },
  { name: "Rahim Chowdhury", email: "rahim@biai.com.bd", role: "Sales" },
];

/** Sample #16 threatens a public complaint today, so it starts as urgent. */
const URGENT_SAMPLES = new Set(["16"]);

export async function seedUsers(pool) {
  if ((await users.count(pool)) > 0) return 0;
  const passwordHash = await hashPassword(config.demoPassword);
  for (const user of DEMO_USERS) await users.insert(pool, { ...user, passwordHash });
  return DEMO_USERS.length;
}

/** Import the 20 supplied enquiries (19 contacts) when there are no leads. */
export async function seedSampleLeads(pool, leadsService, { force = false } = {}) {
  if (!force && (await leadsRepo.count(pool)) > 0) return 0;
  for (const row of samples) {
    await leadsService.ingest(
      {
        ...sampleAnalysis(row),
        message: row.message,
        channel: row.channel,
        receivedAt: row["received at"].replace(" ", "T") + ":00+06:00",
        sourceId: row.id,
        priority: URGENT_SAMPLES.has(row.id) ? "Urgent" : "Normal",
      },
      "Sample import",
    );
  }
  return samples.length;
}

/** Remove all contacts and automation history, then re-import the samples. */
export async function resetDemoData(pool, leadsService) {
  await pool.query("TRUNCATE leads, automation_jobs CASCADE");
  await pool.query("DELETE FROM settings WHERE key = 'automation'");
  return seedSampleLeads(pool, leadsService, { force: true });
}
