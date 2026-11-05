import { badRequest } from "../utils/http-error.js";

/** Validate and replace `req.body` with the parsed result of a zod schema. */
export function validateBody(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      const issue = result.error.issues[0];
      const field = issue.path.join(".");
      throw badRequest(issue.message, field ? { field } : undefined);
    }
    req.body = result.data;
    next();
  };
}
