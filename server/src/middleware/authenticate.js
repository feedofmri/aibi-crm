import { config } from "../config/env.js";
import { verifySession } from "../modules/auth/auth.service.js";
import { forbidden, unauthorized } from "../utils/http-error.js";

/**
 * Require a valid session cookie and attach the current user to `req.user`.
 * The user is re-loaded on each request so deleted accounts lose access
 * immediately and role changes apply without signing out.
 */
export function authenticate(authService) {
  return async (req, _res, next) => {
    const claims = verifySession(req.cookies?.[config.sessionCookie]);
    if (!claims) throw unauthorized();
    const user = await authService.findUser(claims.sub);
    if (!user) throw unauthorized("Your session has ended. Please sign in again.");
    req.user = user;
    next();
  };
}

/** Allow only the listed roles (Admin is always allowed). */
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (req.user.role !== "Admin" && !roles.includes(req.user.role)) throw forbidden();
    next();
  };
}
