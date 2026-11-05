import { forbidden } from "../utils/http-error.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defence in depth for cookie sessions: state-changing requests that
 * carry an Origin header must come from this same host. (The session cookie
 * is also SameSite=Lax.)
 */
export function sameOrigin(req, _res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const origin = req.get("origin");
  if (!origin) return next();
  let host;
  try {
    host = new URL(origin).host;
  } catch {
    throw forbidden("Cross-site requests are not allowed.");
  }
  if (host !== req.get("host")) throw forbidden("Cross-site requests are not allowed.");
  next();
}
