import { Router } from "express";
import { z } from "zod";
import { ROLES } from "../../domain/lead.js";
import { requireRole } from "../../middleware/authenticate.js";
import { validateBody } from "../../middleware/validate.js";

const createUserSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(200),
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters.").max(200),
  role: z.enum(ROLES, { message: "Choose a role." }),
});

export function usersRoutes({ authService }) {
  const router = Router();

  router.get("/", async (_req, res) => {
    res.json({ users: await authService.listUsers() });
  });

  router.post("/", requireRole("Admin"), validateBody(createUserSchema), async (req, res) => {
    res.status(201).json({ user: await authService.createUser(req.body) });
  });

  return router;
}
