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
  /**
   * Shared secret for inbound channel traffic (the channel simulator site, or
   * a future WhatsApp/Facebook webhook). Without it in production the
   * inbound endpoint is disabled.
   */
  channelKey: env.CHANNEL_KEY || (isProduction ? "" : "dev-channel-key"),
  /** Browser origins allowed to call the inbound endpoint (the simulator site). */
  channelOrigins: (env.CHANNEL_ALLOWED_ORIGINS || (isProduction ? "" : "http://localhost:5174,http://127.0.0.1:5174"))
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  /** Public URLs used to link the two sites to each other. */
  crmUrl: env.CRM_PUBLIC_URL || "http://localhost:5173",
  simulatorUrl: env.SIMULATOR_PUBLIC_URL || "http://localhost:5174",
  /** Demo accounts are seeded with this password; shown on the login screen. */
  demoPassword: "Admin123!",
  timezone: "Asia/Dhaka",
});
