import { Router } from "express";
import { resetDemoData } from "../../db/seed.js";
import { requireRole } from "../../middleware/authenticate.js";

export function adminRoutes({ pool, leadsService }) {
  const router = Router();

  /** Restore the 20 supplied sample enquiries (useful before a demo). */
  router.post("/reset-demo", requireRole("Admin"), async (_req, res) => {
    const imported = await resetDemoData(pool, leadsService);
    res.json({ imported });
  });

  return router;
}
