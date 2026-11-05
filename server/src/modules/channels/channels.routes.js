import { timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { config } from "../../config/env.js";
import { CHANNELS, validateLead } from "../../domain/lead.js";
import { validateBody } from "../../middleware/validate.js";
import { HttpError, unauthorized } from "../../utils/http-error.js";

const messageSchema = z.object({
  message: z.string().trim().min(1, "Type a message first.").max(8000),
  channel: z.enum(CHANNELS, { message: "Choose a valid channel." }).default("WhatsApp"),
  name: z.string().trim().max(200).default(""),
  phone: z.string().trim().max(40).default(""),
});

const inboundLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: config.isTest ? 1000 : 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: { message: "Too many messages. Wait a minute and try again." } },
});

/** Allow the separately hosted simulator site to call these routes from the browser. */
function channelCors(req, res, next) {
  const origin = req.get("origin");
  if (origin && config.channelOrigins.includes(origin)) {
    res.set({
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Channel-Key",
      "Access-Control-Max-Age": "600",
      Vary: "Origin",
    });
  }
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
}

/** Inbound traffic authenticates with a shared channel key, never a staff session. */
function requireChannelKey(req, _res, next) {
  if (!config.channelKey) throw new HttpError(503, "Inbound channels are disabled. Set CHANNEL_KEY on the server.");
  const given = Buffer.from(String(req.get("x-channel-key") || ""));
  const expected = Buffer.from(config.channelKey);
  if (given.length !== expected.length || !timingSafeEqual(given, expected))
    throw unauthorized("Missing or invalid channel key.");
  next();
}

/**
 * Inbound channel API, used by the channel simulator website (and the shape a
 * real WhatsApp/Facebook webhook adapter would use). A message is extracted,
 * routed and saved exactly like a real enquiry. Nothing is ever sent back to
 * the customer; the drafted reply is returned so the simulator can show it.
 */
export function channelsRoutes({ leadsService, ai, samples }) {
  const router = Router();
  router.use(channelCors, requireChannelKey);

  router.get("/info", (_req, res) => {
    const live = ai.liveEnabled();
    res.json({
      channels: CHANNELS,
      ai: live ? { mode: "live", provider: ai.aiConfig().provider } : { mode: "rules", provider: null },
      crmUrl: config.crmUrl,
      samples: samples.map((s) => ({
        id: s.id,
        channel: s.channel,
        name: s["sender name"],
        phone: s.phone,
        message: s.message,
      })),
    });
  });

  router.post("/inbound", inboundLimiter, validateBody(messageSchema), async (req, res) => {
    const { message, channel, name, phone } = req.body;
    const analysis = await ai.analyze({ message, channel, name, phone, allowHeuristic: true });
    const valid = validateLead({
      name: analysis.name && analysis.name !== "Unknown" ? analysis.name : name || "Unknown",
      phone: analysis.phone || phone,
      program: analysis.program,
      route: analysis.route,
      language: analysis.language,
      status: "New",
      owner: "",
      notes: "",
      nextFollowUp: "",
    });
    const { lead, created } = await leadsService.ingest(
      {
        ...valid,
        message,
        channel,
        reply: analysis.reply,
        reason: analysis.reason,
        mode: analysis.mode,
        receivedAt: new Date().toISOString(),
        applyReview: true,
      },
      `Channel simulator (${channel})`,
    );

    // Return only what the channel needs, not the whole CRM record.
    res.status(created ? 201 : 200).json({
      created,
      contact: {
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        program: lead.program,
        route: lead.route,
        language: lead.language,
        messages: lead.messages.length,
        crmUrl: `${config.crmUrl}/enquiries?contact=${lead.id}`,
      },
      analysis: { mode: analysis.mode, reason: analysis.reason },
      reply: lead.route === "Spam" ? "" : analysis.reply,
    });
  });

  return router;
}
