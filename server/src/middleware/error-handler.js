import { config } from "../config/env.js";
import { HttpError, notFound } from "../utils/http-error.js";

export function notFoundHandler(req, _res, next) {
  next(notFound(`No API route for ${req.method} ${req.path}.`));
}

/**
 * Convert any thrown error into a consistent JSON response:
 * `{ error: { message, details? } }`. Unknown errors are logged and hidden.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(error, req, res, _next) {
  let status = 500;
  let message = "Something went wrong on our side. Please try again.";
  let details;

  if (error instanceof HttpError) {
    ({ status, message, details } = error);
  } else if (error.type === "entity.parse.failed") {
    status = 400;
    message = "The request body is not valid JSON.";
  } else if (error.type === "entity.too.large") {
    status = 413;
    message = "The request is too large.";
  } else if (error.name === "TimeoutError") {
    status = 504;
    message = "The AI provider timed out. Retry, or enter the details manually.";
  } else if (error.code === "22P02") {
    status = 404;
    message = "Not found.";
  } else if (error.code === "23505") {
    status = 409;
    message = "This record conflicts with an existing one (for example, the same phone number).";
  } else if (error.name === "ValidationError") {
    status = 400;
    message = error.message;
  } else if (error.name === "AiError") {
    status = 502;
    message = error.message;
  } else {
    console.error(`[api] ${req.method} ${req.originalUrl}:`, error);
  }

  if (status >= 500 && !config.isProduction && !(error instanceof HttpError)) details = { cause: error.message };
  res.status(status).json({ error: { message, ...(details ? { details } : {}) } });
}
