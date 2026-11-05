import { Router } from "express";
import { z } from "zod";
import { CHANNELS, LANGUAGES, PROGRAMS, ROUTES, STAGES } from "../../domain/lead.js";
import { requireRole } from "../../middleware/authenticate.js";
import { validateBody } from "../../middleware/validate.js";

const text = (max) => z.string().max(max);

const updateSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a name.").max(200),
    phone: text(40),
    program: z.enum(PROGRAMS),
    route: z.enum(ROUTES),
    language: z.enum(LANGUAGES),
    status: z.enum(STAGES),
    supportStatus: z.enum(["Open", "Resolved"]),
    priority: z.enum(["Normal", "Urgent"]),
    owner: text(200),
    notes: text(10000),
    nextAction: text(500),
    nextFollowUp: z.union([z.iso.datetime({ offset: true }), z.literal("")]),
    draft: text(10000),
  })
  .partial()
  .strict();

const idParam = z.uuid();

const replySchema = z.object({
  text: z.string().trim().min(1, "Write the reply that was sent.").max(10000),
  channel: z.enum(CHANNELS).optional(),
});

export function leadsRoutes({ leadsService }) {
  const router = Router();

  router.param("id", (req, _res, next, id) => {
    if (!idParam.safeParse(id).success) {
      req.params.id = "00000000-0000-0000-0000-000000000000"; // resolves to 404
    }
    next();
  });

  router.get("/", async (_req, res) => {
    res.json({ leads: await leadsService.list() });
  });

  router.get("/:id", async (req, res) => {
    res.json({ lead: await leadsService.get(req.params.id) });
  });

  router.patch("/:id", validateBody(updateSchema), async (req, res) => {
    res.json({ lead: await leadsService.update(req.params.id, req.body, req.user) });
  });

  router.delete("/:id", requireRole("Admin"), async (req, res) => {
    await leadsService.remove(req.params.id);
    res.status(204).end();
  });

  router.post("/:id/contact", async (req, res) => {
    res.json({ lead: await leadsService.logContact(req.params.id, req.user) });
  });

  router.post("/:id/draft", async (req, res) => {
    res.json({ lead: await leadsService.generateDraft(req.params.id, req.user) });
  });

  /** Record a reply the team member sent outside the CRM (WhatsApp, phone…). */
  router.post("/:id/reply", validateBody(replySchema), async (req, res) => {
    const lead = await leadsService.recordReply(req.params.id, {
      text: req.body.text,
      channel: req.body.channel,
      author: req.user.name,
      delivery: "manual",
    });
    res.json({ lead });
  });

  return router;
}
