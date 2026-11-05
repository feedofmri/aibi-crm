import { Router } from "express";
import { config } from "../../config/env.js";
import { CHANNELS, FOLLOW_UP_HOURS, LANGUAGES, PROGRAMS, ROLES, ROUTES, STAGES } from "../../domain/lead.js";

/** Reference data and runtime capabilities the client needs to render forms. */
export function metaRoutes({ ai, samples }) {
  const router = Router();

  router.get("/", (_req, res) => {
    const live = ai.liveEnabled();
    const { provider, model } = ai.aiConfig();
    res.json({
      stages: STAGES,
      routes: ROUTES,
      programs: PROGRAMS,
      languages: LANGUAGES,
      channels: CHANNELS,
      roles: ROLES,
      followUpHours: FOLLOW_UP_HOURS,
      ai: live ? { mode: "live", provider, model } : { mode: "rules", provider: null, model: null },
      database: "PostgreSQL",
      simulatorUrl: config.simulatorUrl,
      samples: samples.map((s) => ({
        id: s.id,
        channel: s.channel,
        name: s["sender name"],
        phone: s.phone,
        message: s.message,
        receivedAt: s["received at"].replace(" ", "T") + ":00+06:00",
      })),
    });
  });

  return router;
}
