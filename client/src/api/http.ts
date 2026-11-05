/** An error returned by the API, with a message written for end users. */
export class ApiError extends Error {
  readonly status: number;
  readonly field?: string;

  constructor(status: number, message: string, field?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.field = field;
  }
}

type Listener = () => void;
const unauthorizedListeners = new Set<Listener>();

/** Subscribe to "session expired" so the app can return to the sign-in page. */
export function onUnauthorized(listener: Listener) {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

export async function request<T>(path: string, { method = "GET", body, signal }: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      signal,
      credentials: "same-origin",
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }

  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && path !== "/auth/login" && path !== "/auth/me") {
      unauthorizedListeners.forEach((listener) => listener());
    }
    const message = data?.error?.message ?? `Request failed (${response.status}).`;
    throw new ApiError(response.status, message, data?.error?.details?.field);
  }
  return data as T;
}
