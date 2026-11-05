import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { config } from "../../config/env.js";
import { validateBody } from "../../middleware/validate.js";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password.").max(200),
});

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax",
  secure: config.isProduction,
  path: "/",
});

export function authRoutes({ authService, authenticate }) {
  const router = Router();

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.isTest ? 1000 : 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: { message: "Too many sign-in attempts. Try again in a few minutes." } },
  });

  router.post("/login", loginLimiter, validateBody(loginSchema), async (req, res) => {
    const { user, token } = await authService.login(req.body.email, req.body.password);
    res.cookie(config.sessionCookie, token, {
      ...cookieOptions(),
      maxAge: config.sessionTtlSeconds * 1000,
    });
    res.json({ user });
  });

  router.post("/logout", (_req, res) => {
    res.clearCookie(config.sessionCookie, cookieOptions());
    res.status(204).end();
  });

  router.get("/me", authenticate, (req, res) => {
    res.json({ user: req.user });
  });

  return router;
}
