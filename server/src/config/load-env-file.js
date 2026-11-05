import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Optional settings file for hosts where entering variables one by one is
 * awkward (cPanel). It lives in the account's home folder (~/biai.env), outside
 * any website folder, so it can never be downloaded. Variables already set in
 * the environment (cPanel's "Setup Node.js App" screen) take precedence.
 *
 * Imported first by src/index.js, before anything reads process.env.
 */
const path = process.env.BIAI_ENV_FILE || join(homedir(), "biai.env");

if (existsSync(path)) {
  process.loadEnvFile(path);
  console.log(`[config] loaded settings from ${path}`);
}
