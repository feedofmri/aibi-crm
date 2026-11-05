import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { authenticate } from "./middleware/authenticate.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { sameOrigin } from "./middleware/same-origin.js";
import { adminRoutes } from "./modules/admin/admin.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { createAuthService } from "./modules/auth/auth.service.js";
import { channelsRoutes } from "./modules/channels/channels.routes.js";
import { automationRoutes } from "./modules/automation/automation.routes.js";
import { createAutomationService } from "./modules/automation/automation.service.js";
import { intakeRoutes } from "./modules/intake/intake.routes.js";
import { leadsRoutes } from "./modules/leads/leads.routes.js";
import { createLeadsService } from "./modules/leads/leads.service.js";
import { metaRoutes } from "./modules/meta/meta.routes.js";
import { reportsRoutes } from "./modules/reports/reports.routes.js";
import { createReportsService } from "./modules/reports/reports.service.js";
import { usersRoutes } from "./modules/users/users.routes.js";
import * as defaultAi from "./services/ai/ai.service.js";
import { samples } from "./services/ai/samples.js";

const CLIENT_DIST = fileURLToPath(new URL("../../client/dist/", import.meta.url));

/** Build the services once so routes and background tasks share them. */
export function createServices({ pool, ai = defaultAi }) {
  const authService = createAuthService({ pool });
  const leadsService = createLeadsService({ pool, ai });
  const automationService = createAutomationService({ pool, ai, leadsService, samples });
  const reportsService = createReportsService({ pool, ai });
  return { pool, ai, samples, authService, leadsService, automationService, reportsService };
}

export function createApp(services, { serveClient = true } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", "loopback");

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "default-src": ["'self'"],
          "img-src": ["'self'", "data:"],
          "style-src": ["'self'", "'unsafe-inline'"],
          "connect-src": ["'self'"],
          "frame-ancestors": ["'none'"],
        },
      },
    }),
  );
  app.use(express.json({ limit: "64kb" }));
  app.use(cookieParser());

  const api = express.Router();
  const requireAuth = authenticate(services.authService);

  api.get("/health", async (_req, res) => {
    await services.pool.query("SELECT 1");
    res.json({ status: "ok" });
  });
  // Inbound channels authenticate with a channel key (and allow the simulator
  // site's origin), so they sit before the staff session and same-origin checks.
  api.use("/channels", channelsRoutes(services));
  api.use(sameOrigin);
  api.use("/auth", authRoutes({ authService: services.authService, authenticate: requireAuth }));

  // Everything below requires a signed-in team member.
  api.use(requireAuth);
  api.use("/meta", metaRoutes(services));
  api.use("/users", usersRoutes(services));
  api.use("/leads", leadsRoutes(services));
  api.use("/intake", intakeRoutes(services));
  api.use("/automation", automationRoutes(services));
  api.use("/reports", reportsRoutes(services));
  api.use("/admin", adminRoutes(services));
  api.use(notFoundHandler);

  app.use("/api", api);

  // In production the API also serves the built React app (single origin).
  if (serveClient && existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST, { index: false, maxAge: "1h" }));
    app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(CLIENT_DIST + "index.html"));
  }

  app.use(errorHandler);
  return app;
}
