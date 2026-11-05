import { Router } from "express";
import { z } from "zod";
import { CHANNELS, validateLead } from "../../domain/lead.js";
import { validateBody } from "../../middleware/validate.js";
import { aiLimiter } from "../intake/intake.routes.js";

const messageSchema = z.object({
  message: z.string().trim().min(1, "Type a message first.").max(8000),
  channel: z.enum(CHANNELS).default("WhatsApp"),
  name: z.string().trim().max(200).default(""),
  phone: z.string().trim().max(40).default(""),
});

/**
 * Channel simulator: treat a typed test message exactly like a real inbound
 * enquiry (extract, route, save). No real channel is connected; nothing is sent.
 */
export function simulatorRoutes({ leadsService, ai }) {
  const router = Router();

  router.post("/messages", aiLimiter, validateBody(messageSchema), async (req, res) => {
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
    const saved = await leadsService.ingest(
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
      `Simulator (${channel})`,
    );
    res.json({ lead: saved.lead, created: saved.created, analysis });
  });

  return router;
}
