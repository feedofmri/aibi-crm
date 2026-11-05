import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { config } from "../../config/env.js";
import { CHANNELS, LANGUAGES, PROGRAMS, ROUTES } from "../../domain/lead.js";
import { validateBody } from "../../middleware/validate.js";
import { badRequest } from "../../utils/http-error.js";

const message = z.string().trim().min(1, "Paste the enquiry message.").max(8000, "Messages are limited to 8,000 characters.");
const channel = z.enum(CHANNELS, { message: "Choose a valid source channel." });

const analyzeSchema = z.object({
  message,
  channel: channel.default("WhatsApp"),
  name: z.string().max(200).default(""),
  phone: z.string().max(40).default(""),
});

const saveSchema = z.object({
  message,
  channel,
  name: z.string().trim().min(1, "Enter a name.").max(200),
  phone: z.string().max(40).default(""),
  program: z.enum(PROGRAMS),
  route: z.enum(ROUTES),
  language: z.enum(LANGUAGES),
  reply: z.string().max(10000).default(""),
  reason: z.string().max(2000).default(""),
  mode: z.enum(["live", "sample", "heuristic", "manual"]).default("manual"),
  sourceId: z.string().max(20).optional(),
});

/** Limits paid AI calls per client. */
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: config.isTest ? 1000 : 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: { message: "Too many AI requests. Wait a minute and try again." } },
});

export function intakeRoutes({ leadsService, ai, samples }) {
  const router = Router();

  /** Extract structured details and a draft reply. Nothing is saved. */
  router.post("/analyze", aiLimiter, validateBody(analyzeSchema), async (req, res) => {
    const analysis = await ai.analyze({ ...req.body, allowHeuristic: true });
    res.json({ analysis });
  });

  /** Save a human-reviewed enquiry (creates a contact or joins an existing one). */
  router.post("/", validateBody(saveSchema), async (req, res) => {
    const input = req.body;
    let receivedAt;
    if (input.sourceId) {
      const source = samples.find((s) => s.id === input.sourceId);
      if (!source || source.message !== input.message || source.channel !== input.channel)
        throw badRequest("This message does not match the supplied sample it claims to be.");
      receivedAt = source["received at"].replace(" ", "T") + ":00+06:00";
    }
    const mode = input.mode === "live" && !ai.liveEnabled() ? "manual" : input.mode;
    const result = await leadsService.ingest(
      { ...input, mode, receivedAt, applyReview: true },
      req.user.name,
    );
    res.status(result.created ? 201 : 200).json(result);
  });

  return router;
}
