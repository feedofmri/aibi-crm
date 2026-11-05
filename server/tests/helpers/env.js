// Loaded first by every test file: force test mode and offline AI so results
// are deterministic and no paid provider is ever called.
process.env.NODE_ENV = "test";
for (const key of ["GEMINI_API_KEY", "MODEL_API_KEY", "META_MODEL", "OPENAI_API_KEY", "OPENAI_MODEL"]) {
  delete process.env[key];
}

/** Temporarily set environment variables for the duration of `fn`. */
export async function withEnv(vars, fn) {
  const saved = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  Object.assign(process.env, vars);
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

/** A fake fetch that returns an OpenAI/Meta Responses-API payload. */
export const responsesReply = (value) => async () => ({
  ok: true,
  json: async () => ({
    status: "completed",
    output: [{ content: [{ type: "output_text", text: typeof value === "string" ? value : JSON.stringify(value) }] }],
  }),
});
