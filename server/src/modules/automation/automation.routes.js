import { Router } from "express";
import { z } from "zod";
import { CHANNELS, LANGUAGES, PROGRAMS, ROUTES } from "../../domain/lead.js";
import { requireRole } from "../../middleware/authenticate.js";
import { validateBody } from "../../middleware/validate.js";
import { aiLimiter } from "../intake/intake.routes.js";

const settingsSchema = z
  .object({ mode: z.enum(["manual", "automatic"]), autoReply: z.enum(["off", "safe"]) })
  .partial()
  .refine((v) => v.mode || v.autoReply, "Choose a setting to change.");

const processSchema = z.object({
  message: z.string().trim().min(1, "Paste the enquiry message.").max(8000),
  channel: z.enum(CHANNELS, { message: "Choose a valid source channel." }),
  name: z.string().max(200).default(""),
  phone: z.string().max(40).default(""),
});

const reviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  changes: z
    .object({
      name: z.string().trim().min(1).max(200),
      phone: z.string().max(40),
      program: z.enum(PROGRAMS),
      route: z.enum(ROUTES),
      language: z.enum(LANGUAGES),
      reply: z.string().max(10000),
    })
    .partial()
    .default({}),
});

export function automationRoutes({ automationService }) {
  const router = Router();

  router.get("/", async (_req, res) => {
    const [settings, jobs] = await Promise.all([
      automationService.settings(),
      automationService.listJobs(),
    ]);
    res.json({ settings, jobs });
  });

  router.put("/settings", requireRole("Admissions"), validateBody(settingsSchema), async (req, res) => {
    res.json({ settings: await automationService.saveSettings(req.body) });
  });

  router.post("/jobs", aiLimiter, validateBody(processSchema), async (req, res) => {
    res.json({ job: await automationService.process(req.body) });
  });

  router.post("/jobs/:id/review", validateBody(reviewSchema), async (req, res) => {
    const { action, changes } = req.body;
    res.json({ job: await automationService.review(req.params.id, action, changes, req.user) });
  });

  return router;
}
