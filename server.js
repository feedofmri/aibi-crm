import { createAutomation } from "./lib/automation.js";
import { createServer } from "node:http";
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { createStore } from "./lib/store.js";
import { createPgStore } from "./lib/pgstore.js";
import {
  hashPassword,
  comparePassword,
  createToken,
  verifyToken,
} from "./lib/auth.js";
import {
  STAGES,
  ROUTES,
  PROGRAMS,
  LANGUAGES,
  validateLead,
  stats,
  overdue,
} from "./lib/domain.js";
import { samples } from "./lib/samples.js";
import {
  analyze,
  summarize,
  draftReply,
  liveEnabled,
  aiConfig,
} from "./lib/ai.js";

const root = dirname(fileURLToPath(import.meta.url));
const CHANNELS = [
  "WhatsApp",
  "Facebook Messenger",
  "Facebook comment",
  "Website form",
  "Phone call note",
];

async function body(req) {
  let data = "";
  for await (const chunk of req) {
    data += chunk;
    if (Buffer.byteLength(data) > 32000) throw new Error("Message too large.");
  }
  try {
    return JSON.parse(data);
  } catch {
    throw new Error("Invalid request body.");
  }
}

function getAuthUser(req) {
  const auth = req.headers["authorization"];
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return verifyToken(auth.slice(7).trim());
}

export function createApp(mainStore, demoStore = mainStore) {
  const automation = new Map(
    [mainStore, demoStore].map((s) => [s, createAutomation(s)]),
  );

  return createServer(async (req, res) => {
    const send = (status, value) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(value));
    };

    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );

    try {
      const url = new URL(req.url, "http://localhost");
      const path = url.pathname;
      const practice = url.searchParams.get("workspace") === "practice";
      const store = practice ? demoStore : mainStore;

      if (!["GET", "POST", "PATCH", "DELETE"].includes(req.method))
        return send(405, { error: "Method not supported." });

      if (req.method !== "GET") {
        if (
          req.headers.origin &&
          req.headers.origin !== `http://${req.headers.host}` &&
          req.headers.origin !== `https://${req.headers.host}`
        )
          return send(403, { error: "Cross-origin changes are not allowed." });
        if (
          req.method !== "DELETE" &&
          !req.headers["content-type"]?.startsWith("application/json")
        )
          return send(415, { error: "JSON required." });
      }

      // -------------------------------------------------------------
      // Auth Endpoints
      // -------------------------------------------------------------
      if (path === "/api/auth/login" && req.method === "POST") {
        const input = await body(req);
        if (!input.email || !input.password)
          throw new Error("Email and password are required.");
        const user = await store.findUserByEmail(input.email);
        if (!user) throw new Error("Invalid email or password.");
        const ok = await comparePassword(
          input.password,
          user.passwordHash || user.password_hash,
        );
        if (!ok) throw new Error("Invalid email or password.");
        const safeUser = {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
        const token = createToken(safeUser);
        return send(200, { token, user: safeUser });
      }

      if (path === "/api/auth/register" && req.method === "POST") {
        const input = await body(req);
        if (!input.email || !input.password || !input.name)
          throw new Error("Name, email and password are required.");
        if (input.password.length < 6)
          throw new Error("Password must be at least 6 characters.");
        const existing = await store.findUserByEmail(input.email);
        if (existing)
          throw new Error("A user with this email already exists.");
        const hash = await hashPassword(input.password);
        const newUser = await store.createUser({
          email: input.email,
          passwordHash: hash,
          password: input.password,
          name: input.name,
          role: input.role || "Admissions",
        });
        const safeUser = {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
        };
        const token = createToken(safeUser);
        return send(201, { token, user: safeUser });
      }

      if (path === "/api/auth/me" && req.method === "GET") {
        const user = getAuthUser(req);
        if (!user) return send(401, { error: "Authentication required." });
        return send(200, { user });
      }

      if (path === "/api/auth/users" && req.method === "GET") {
        const users = store.listUsers ? await store.listUsers() : [];
        return send(200, { users });
      }

      // -------------------------------------------------------------
      // System & CRM State
      // -------------------------------------------------------------
      if (path === "/api/state" && req.method === "GET") {
        const allLeads = await store.all();
        const appSettings = await store.settings();
        const appJobs = await store.jobs();
        const teamUsers = store.listUsers ? await store.listUsers() : [];
        return send(200, {
          automation: appSettings,
          jobs: appJobs,
          practice,
          leads: allLeads,
          stats: stats(allLeads),
          samples,
          stages: STAGES,
          routes: ROUTES,
          programs: PROGRAMS,
          languages: LANGUAGES,
          team: teamUsers,
          db: store.isPg
            ? "PostgreSQL (production database: biai_crm)"
            : "SQLite (local database: crm.sqlite)",
          isPg: !!store.isPg,
          mode: liveEnabled() ? "live" : "offline-nlp",
          ai: liveEnabled()
            ? { provider: aiConfig().provider, model: aiConfig().model }
            : {
                provider: "Offline NLP / Hybrid Rules",
                model: "Bengali-English Intent Classifier",
              },
          now: new Date().toISOString(),
        });
      }

      if (path === "/api/automation/settings" && req.method === "POST")
        return send(200, await store.saveSettings(await body(req)));

      if (path === "/api/automation/process" && req.method === "POST")
        return send(200, await automation.get(store).process(await body(req)));

      const reviewMatch = path.match(
        /^\/api\/automation\/([a-z0-9-]+)\/review$/,
      );
      if (reviewMatch && req.method === "POST") {
        const input = await body(req);
        return send(
          200,
          await automation
            .get(store)
            .review(reviewMatch[1], input.action, input.changes),
        );
      }

      if (path === "/api/analyze" && req.method === "POST") {
        const input = await body(req);
        if (
          typeof input.message !== "string" ||
          !input.message.trim() ||
          input.message.length > 8000
        )
          throw new Error("Paste a message of 1–8000 characters.");
        return send(
          200,
          await analyze({
            message: input.message,
            name: String(input.name || ""),
            phone: String(input.phone || ""),
            channel: String(input.channel || "WhatsApp"),
            allowHeuristic: true,
          }),
        );
      }

      if (path === "/api/leads" && req.method === "POST") {
        const input = await body(req);
        if (
          typeof input.message !== "string" ||
          !input.message.trim() ||
          input.message.length > 8000 ||
          !CHANNELS.includes(input.channel)
        )
          throw new Error("A message and valid source channel are required.");
        const valid = validateLead({
          ...input,
          status: "New",
          owner: "",
          notes: "",
          nextFollowUp: "",
        });
        if (
          input.receivedAt &&
          (!Number.isFinite(Date.parse(input.receivedAt)) ||
            Date.parse(input.receivedAt) > Date.now())
        )
          throw new Error("Invalid received time.");
        if (input.sourceId) {
          const source = samples.find((s) => s.id === input.sourceId);
          if (
            !source ||
            source.message !== input.message ||
            source.channel !== input.channel
          )
            throw new Error(
              "Source message does not match the supplied sample.",
            );
        }
        return send(
          201,
          await store.add({
            ...valid,
            applyReview: true,
            reason: String(input.reason || ""),
            reply: String(input.reply || ""),
            mode:
              liveEnabled() && input.mode === "live"
                ? "live"
                : input.mode === "sample"
                  ? "sample"
                  : "manual",
          }),
        );
      }

      const match = path.match(
        /^\/api\/leads\/([a-z0-9-]+)(?:\/(contact|draft))?$/,
      );
      if (match) {
        const lead = await store.get(match[1]);
        if (!lead) return send(404, { error: "Lead not found." });

        if (req.method === "DELETE" && !match[2]) {
          await store.remove(match[1]);
          return send(200, { success: true });
        }

        if (req.method === "PATCH" && !match[2]) {
          const input = await body(req);
          const allowed = [
            "name",
            "phone",
            "program",
            "route",
            "language",
            "status",
            "owner",
            "notes",
            "nextFollowUp",
            "supportStatus",
            "priority",
            "nextAction",
            "draft",
          ];
          const changes = Object.fromEntries(
            Object.entries(input).filter(([k]) => allowed.includes(k)),
          );
          const updated = validateLead({ ...lead, ...changes });
          if (input.draft !== undefined && input.draft !== lead.draft)
            updated.draftMode = "human-reviewed";
          const allLeads = await store.all();
          if (
            updated.phone &&
            allLeads.some((l) => l.id !== lead.id && l.phone === updated.phone)
          )
            throw new Error(
              "This phone belongs to another lead. Review the existing contact instead.",
            );
          const authUser = getAuthUser(req);
          const actor = authUser
            ? `${authUser.name} (${authUser.role})`
            : "Staff";
          updated.audit.push({
            at: new Date().toISOString(),
            action: `Updated by ${actor}: ` + Object.keys(changes).join(", "),
          });
          return send(200, await store.write(updated));
        }

        if (req.method === "POST" && match[2] === "contact") {
          const authUser = getAuthUser(req);
          const actor = authUser ? authUser.name : "Staff";
          lead.lastContactAt = new Date().toISOString();
          if (lead.nextFollowUp && Date.parse(lead.nextFollowUp) <= Date.now())
            lead.nextFollowUp = "";
          if (lead.status === "New") lead.status = "Contacted";
          lead.audit.push({
            at: lead.lastContactAt,
            action: `${actor} confirmed contact completed`,
          });
          return send(200, await store.write(lead));
        }

        if (req.method === "POST" && match[2] === "draft") {
          if (lead.route === "Spam")
            throw new Error("Spam is quarantined. No reply is generated.");
          const result = await draftReply(lead, undefined, {
            allowHeuristic: true,
          });
          const current = await store.get(lead.id);
          current.draft = result.reply;
          current.draftMode = result.mode;
          current.audit.push({
            at: new Date().toISOString(),
            action: "Generated " + result.mode + " reply draft",
          });
          await store.write(current);
          return send(200, current);
        }
      }

      if (path === "/api/summary" && req.method === "POST") {
        const input = await body(req);
        const end = new Date(input.end + "T23:59:59.999+06:00");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(input.end) || !Number.isFinite(+end))
          throw new Error("Choose a valid week ending date.");
        const start = new Date(+end - 7 * 86400000 + 1);
        const all = await store.all();
        const period = all.filter((l) =>
          l.messages.some(
            (m) =>
              Date.parse(m.receivedAt) >= +start &&
              Date.parse(m.receivedAt) <= +end,
          ),
        );
        const data = {
          period: `Seven days ending ${input.end} (Asia/Dhaka)`,
          count: period.reduce(
            (n, l) =>
              n +
              l.messages.filter(
                (m) =>
                  Date.parse(m.receivedAt) >= +start &&
                  Date.parse(m.receivedAt) <= +end,
              ).length,
            0,
          ),
          leadCount: period.length,
          sales: period.filter((l) => l.route === "Sales").length,
          support: period.filter((l) => l.route === "Support").length,
          overdue: all.filter((l) => overdue(l)).length,
          notes: period.map((l) => ({
            name: l.name,
            route: l.route,
            notes: l.notes,
          })),
        };
        return send(
          200,
          await summarize(data, undefined, { allowHeuristic: true }),
        );
      }

      // -------------------------------------------------------------
      // Simulator Inbound Message Endpoint
      // -------------------------------------------------------------
      if (path === "/api/simulator/send" && req.method === "POST") {
        const input = await body(req);
        if (
          typeof input.message !== "string" ||
          !input.message.trim() ||
          input.message.length > 8000
        )
          throw new Error("Message text of 1–8000 characters is required.");

        const channel = CHANNELS.includes(input.channel)
          ? input.channel
          : "WhatsApp";
        const name = String(input.name || "Enquirer").trim();
        const phone = String(input.phone || "").trim();

        const analysis = await analyze({
          message: input.message,
          name,
          phone,
          channel,
          allowHeuristic: true,
        });

        const valid = validateLead({
          name: analysis.name || name || "Prospective Student",
          phone: analysis.phone || phone,
          program: analysis.program,
          route: analysis.route,
          language: analysis.language,
          channel,
          message: input.message,
          status: "New",
          owner: "",
          notes: analysis.reason || "",
          nextFollowUp: "",
        });

        const saved = await store.add(
          {
            ...valid,
            applyReview: true,
            reason: analysis.reason,
            reply: analysis.reply,
            mode: analysis.mode,
            receivedAt: new Date().toISOString(),
          },
          `Simulator (${channel})`,
        );

        return send(200, {
          success: true,
          lead: saved.lead,
          isNewLead: !saved.updated,
          analysis,
          reply: saved.lead.draft || analysis.reply,
        });
      }

      if (path.startsWith("/api/"))
        return send(404, { error: "Endpoint not found." });

      const files = {
        "/": ["index.html", "text/html"],
        "/simulator": ["simulator.html", "text/html"],
        "/simulator.html": ["simulator.html", "text/html"],
        "/simulator.js": ["simulator.js", "text/javascript"],
        "/simulator.css": ["simulator.css", "text/css"],
        "/icons.js": ["icons.js", "text/javascript"],
        "/app.js": ["app.js", "text/javascript"],
        "/style.css": ["style.css", "text/css"],
        "/brand.css": ["brand.css", "text/css"],
        "/assets/biai-icon.png": ["assets/biai-icon.png", "image/png"],
        "/assets/biai-logo.png": ["assets/biai-logo.png", "image/png"],
        "/assets/inter-latin.woff2": ["assets/inter-latin.woff2", "font/woff2"],
        "/assets/hind-siliguri-bengali.woff2": [
          "assets/hind-siliguri-bengali.woff2",
          "font/woff2",
        ],
      };

      if (req.method !== "GET" || !files[path])
        return send(404, { error: "Not found." });

      const [file, type] = files[path];
      res.writeHead(200, {
        "Content-Type":
          type + (type.startsWith("text/") ? "; charset=utf-8" : ""),
        "Cache-Control": "no-cache",
      });
      res.end(readFileSync(resolve(root, "public", file)));
    } catch (error) {
      send(error.name === "TimeoutError" ? 504 : 400, {
        error:
          error.name === "TimeoutError"
            ? "AI timed out. Retry or save manually."
            : error.message,
      });
    }
  });
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  mkdirSync(resolve(root, "data"), { recursive: true });
  const dbUrl =
    process.env.DATABASE_URL ||
    "postgresql://boraq:boraq_dev_password@127.0.0.1:5432/biai_crm";
  let mainStore;
  let demoStore;

  try {
    console.log(
      "Connecting to PostgreSQL at " +
        dbUrl.replace(/:[^:@]+@/, ":****@") +
        "...",
    );
    mainStore = await createPgStore(dbUrl);
    demoStore = mainStore;
    console.log("Connected to PostgreSQL database: biai_crm.");
  } catch (err) {
    console.warn(
      "PostgreSQL connection failed, falling back to SQLite:",
      err.message,
    );
    mainStore = createStore(
      process.env.DB_PATH || resolve(root, "data/crm.sqlite"),
    );
    demoStore = createStore(resolve(root, "data/practice.sqlite"), {
      seedSamples: false,
    });
  }

  const server = createApp(mainStore, demoStore);
  server.listen(
    Number(process.env.PORT || 3000),
    process.env.HOST || "127.0.0.1",
    () =>
      console.log(
        `BIAI CRM ready at http://${process.env.HOST || "127.0.0.1"}:${server.address().port} [Backend: ${mainStore.isPg ? "PostgreSQL" : "SQLite"}] (${liveEnabled() ? "live AI" : "offline hybrid NLP"})`,
      ),
  );

  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () =>
      server.close(async () => {
        if (mainStore.close) await mainStore.close();
        if (demoStore !== mainStore && demoStore.close)
          await demoStore.close();
        process.exit(0);
      }),
    );
}
