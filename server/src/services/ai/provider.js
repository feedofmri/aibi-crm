/**
 * Low-level structured-output calls to the configured model provider.
 *
 * Reliability: every call has an overall time budget, retries transient
 * failures (network errors, timeouts, 408/409/429/5xx) with jittered
 * exponential backoff, and normalises every failure into an AiError that is
 * safe to show to users. Call statistics are kept in memory for the admin view.
 */

/** An AI-provider or extraction problem, written for end users. */
export class AiError extends Error {
  constructor(message, { retryable = false } = {}) {
    super(message);
    this.name = "AiError";
    this.retryable = retryable;
  }
}

export function aiConfig() {
  if (process.env.GEMINI_API_KEY) {
    return {
      provider: "Gemini",
      key: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
      base: "https://generativelanguage.googleapis.com/v1beta",
    };
  }
  return process.env.MODEL_API_KEY
    ? { provider: "Meta", key: process.env.MODEL_API_KEY, model: process.env.META_MODEL, base: "https://api.meta.ai/v1" }
    : { provider: "OpenAI", key: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL, base: "https://api.openai.com/v1" };
}

export const liveEnabled = () => Boolean(aiConfig().key && aiConfig().model);

const TOTAL_BUDGET_MS = 45_000;
const ATTEMPT_TIMEOUT_MS = 25_000;
const MAX_ATTEMPTS = 3;
const RETRY_STATUS = new Set([408, 409, 429, 500, 502, 503, 504]);

const stats = { calls: 0, ok: 0, failed: 0, retries: 0, totalLatencyMs: 0, lastError: "" };

/** Copy of the in-memory call statistics (since the server started). */
export function aiStats() {
  return {
    calls: stats.calls,
    ok: stats.ok,
    failed: stats.failed,
    retries: stats.retries,
    avgLatencyMs: stats.ok ? Math.round(stats.totalLatencyMs / stats.ok) : 0,
    lastError: stats.lastError,
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const backoff = (attempt) =>
  process.env.NODE_ENV === "test" ? 0 : Math.min(4000, 500 * 2 ** attempt) + Math.floor(Math.random() * 250);

/** Gemini's response_schema is an OpenAPI subset: it rejects additionalProperties. */
function geminiSchema(schema) {
  if (Array.isArray(schema)) return schema.map(geminiSchema);
  if (!schema || typeof schema !== "object") return schema;
  const out = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === "additionalProperties") continue;
    out[key] = geminiSchema(value);
  }
  return out;
}

function buildRequest(config, instructions, input, name, schema, timeoutMs) {
  const signal = AbortSignal.timeout(timeoutMs);
  if (config.provider === "Gemini") {
    return [
      `${config.base}/models/${config.model}:generateContent`,
      {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json", "x-goog-api-key": config.key },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: instructions }] },
          contents: [{ role: "user", parts: [{ text: JSON.stringify(input) }] }],
          generationConfig: {
            temperature: 0.2,
            response_mime_type: "application/json",
            response_schema: geminiSchema(schema),
          },
        }),
      },
    ];
  }
  return [
    config.base + "/responses",
    {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.key}` },
      body: JSON.stringify({
        model: config.model,
        store: false,
        instructions,
        input: JSON.stringify(input),
        text: { format: { type: "json_schema", name, strict: true, schema } },
      }),
    },
  ];
}

function readOutput(config, result) {
  if (config.provider === "Gemini") return result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (result.status !== "completed") throw new AiError("AI response incomplete. Please retry.", { retryable: true });
  return result.output
    ?.flatMap((item) => item.content || [])
    .filter((c) => c.type === "output_text")
    .map((c) => c.text)
    .join("");
}

async function attempt(config, args, fetcher, timeoutMs) {
  let res;
  try {
    res = await fetcher(...buildRequest(config, ...args, timeoutMs));
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError")
      throw new AiError("The AI provider took too long to answer.", { retryable: true });
    throw new AiError("Unable to reach the AI provider. Check your network and retry.", { retryable: true });
  }
  if (!res.ok)
    throw new AiError(`AI service returned ${res.status}. Check server configuration or retry.`, {
      retryable: RETRY_STATUS.has(res.status),
    });
  let result;
  try {
    result = await res.json();
  } catch {
    throw new AiError("AI returned an unreadable response.", { retryable: true });
  }
  const output = readOutput(config, result);
  if (!output) throw new AiError("AI could not produce a result. Please review manually.", { retryable: true });
  try {
    return JSON.parse(output);
  } catch {
    throw new AiError("AI returned invalid data. Please review manually.", { retryable: true });
  }
}

/**
 * Ask the model for JSON matching `schema`. Retries transient failures within
 * one overall time budget; throws AiError when it cannot get a valid object.
 */
export async function structured(instructions, input, name, schema, fetcher = fetch, { attempts = MAX_ATTEMPTS } = {}) {
  const config = aiConfig();
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  stats.calls += 1;
  const started = Date.now();
  let lastError;
  for (let i = 0; i < attempts; i++) {
    const remaining = deadline - Date.now();
    if (remaining < 1500) break;
    try {
      const value = await attempt(config, [instructions, input, name, schema], fetcher, Math.min(ATTEMPT_TIMEOUT_MS, remaining));
      stats.ok += 1;
      stats.totalLatencyMs += Date.now() - started;
      return value;
    } catch (error) {
      lastError = error;
      if (!error.retryable || i === attempts - 1) break;
      stats.retries += 1;
      await sleep(backoff(i));
    }
  }
  stats.failed += 1;
  stats.lastError = lastError?.message || "Time budget exhausted";
  throw lastError || new AiError("The AI provider took too long to answer.");
}
