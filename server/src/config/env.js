/**
 * Central, validated runtime configuration. Read once at startup so the rest
 * of the code never touches process.env directly.
 */
const env = process.env;
const isProduction = env.NODE_ENV === "production";
const isTest = env.NODE_ENV === "test";

const DEV_JWT_SECRET = "biai-crm-development-only-secret";

if (isProduction && !env.JWT_SECRET) {
  throw new Error("JWT_SECRET must be set in production.");
}

export const config = Object.freeze({
  isProduction,
  isTest,
  port: Number(env.PORT || 4000),
  host: env.HOST || "127.0.0.1",
  databaseUrl:
    (isTest ? env.TEST_DATABASE_URL : undefined) ||
    env.DATABASE_URL ||
    "postgresql://biai:biai_dev_password@127.0.0.1:5432/biai_crm",
  jwtSecret: env.JWT_SECRET || DEV_JWT_SECRET,
  usingDevSecret: !env.JWT_SECRET,
  sessionCookie: "biai_session",
  sessionTtlSeconds: 7 * 24 * 60 * 60,
  /** Demo accounts are seeded with this password; shown on the login screen. */
  demoPassword: "Admin123!",
  timezone: "Asia/Dhaka",
});
