/** An error that carries an HTTP status and is safe to show to the client. */
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message, details) => new HttpError(400, message, details);
export const unauthorized = (message = "Please sign in to continue.") => new HttpError(401, message);
export const forbidden = (message = "Your role does not allow this action.") => new HttpError(403, message);
export const notFound = (message = "Not found.") => new HttpError(404, message);
export const conflict = (message) => new HttpError(409, message);
