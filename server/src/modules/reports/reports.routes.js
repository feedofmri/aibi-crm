import { Router } from "express";
import { z } from "zod";
import { badRequest } from "../../utils/http-error.js";
import { aiLimiter } from "../intake/intake.routes.js";

const endDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid week-ending date.");

export function reportsRoutes({ reportsService }) {
  const router = Router();

  router.get("/weekly", aiLimiter, async (req, res) => {
    const parsed = endDate.safeParse(req.query.end);
    if (!parsed.success || !Number.isFinite(Date.parse(parsed.data)))
      throw badRequest("Choose a valid week-ending date.");
    res.json({ report: await reportsService.weekly(parsed.data) });
  });

  return router;
}
