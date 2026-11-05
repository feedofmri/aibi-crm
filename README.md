# BIAI Admissions CRM

An admissions and enquiry CRM for Bangladesh AI (BIAI). It turns WhatsApp, Facebook, website and phone enquiries in Bangla, Banglish and English into reviewed contacts, drafts a reply in the sender's language, moves people through a five-stage pipeline and makes sure nobody waits more than 48 hours for a follow-up.

Built on the 20 supplied fictional messages (19 contacts). Prototype for BIAI's Round 2 task.

| Pipeline | Contact |
|---|---|
| ![Pipeline board](docs/screenshots/pipeline.jpg) | ![Contact panel](docs/screenshots/contact.jpg) |
| **Follow-ups** | **Channel simulator** |
| ![Follow-ups](docs/screenshots/follow-ups.jpg) | ![Channel simulator](docs/screenshots/simulator.jpg) |

| Stack | |
|---|---|
| **Client** | React 19, TypeScript, Vite, React Router, TanStack Query, CSS Modules with design tokens, lucide icons |
| **Server** | Node.js 22+, Express 5, layered modules (routes → services → repositories), zod validation, helmet, rate limiting |
| **Database** | PostgreSQL 16 with versioned SQL migrations |
| **Auth** | Email + password (bcrypt), JWT session in an httpOnly SameSite cookie, role checks on the API |
| **AI** | Gemini, Meta or OpenAI structured JSON output; labelled rule-based fallback when no key is set |
| **Tests** | `node:test`: unit tests plus API integration tests against a real PostgreSQL database |

## Quick start

Requirements: Node.js 22+, and Docker (or your own PostgreSQL 16).

```bash
cp .env.example .env
```

```bash
npm install
```

```bash
npm run db:up
```

```bash
npm run dev
```

Already running PostgreSQL? Skip `npm run db:up`, create a `biai_crm` database and set `DATABASE_URL` in `.env`.

Open http://localhost:5173 and pick a demo account. The API runs on :4000; Vite proxies `/api` to it. On first start the server applies migrations, creates the demo team and imports the 20 sample enquiries.

**Demo accounts** (fictional, password `Admin123!`): `admin@biai.com.bd` (Admin), `tanvir@biai.com.bd` (Admissions), `ayesha@biai.com.bd` (Support), `rahim@biai.com.bd` (Sales).

Production build (one process serves the API and the built client on :4000):

```bash
npm run build
```

```bash
npm start
```

Or run everything in Docker with `JWT_SECRET=$(openssl rand -hex 32) docker compose --profile app up --build`. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## What it does

- **Pipeline:** New → Contacted → Interested → Paid → Lost. Drag cards between stages (saved immediately, with an activity entry), or switch to a list.
- **All enquiries:** every contact across Sales, Support, Careers and Spam, filterable by queue, programme, owner and text.
- **Follow-ups:** contacts with no logged contact for 48 hours, or whose scheduled date has passed, grouped Urgent → Support → Sales, with one-click **Log contact**. Delay is graded (due today, overdue, more than 3 days overdue).
- **Contact panel:** the original conversation and the reply draft first; owner, stage, priority, next action, scheduled follow-up and contact details beside it; an activity history showing who changed what.
- **New enquiry:** paste a message (or pick a supplied sample) → extracted details and a draft reply → review and save. A matching phone number joins the existing contact; blank phones never merge.
- **Weekly brief:** calculated totals for any seven Dhaka days, programme interest, support cases and three priorities (live AI or rules), copyable as text.
- **Automation:** manual review, or automatic saving of complete new sales enquiries with every exception held for a person.
- **Channel simulator:** type as a prospect on a simulated channel; the message is processed and saved like a real enquiry. Nothing is sent.
- **Team:** members and roles. Admins add members, delete contacts and restore the sample data.

### Deliberate boundaries

- Nothing is ever sent to a customer. WhatsApp and call buttons open the person's own app.
- A reported payment never marks a contact Paid; support cases always need a person.
- Replies never promise prices, dates, venues, refunds or approvals; the team confirms those.
- Unknown programmes stay "to confirm"; missing phones stay blank and are flagged.
- Without an AI key, the 20 supplied messages use labelled, human-reviewed interpretations, and other text uses a clearly labelled rule-based extractor. Nothing pretends to be live AI.

## Project structure

```
aibi-crm/
├── client/                      React + TypeScript web app
│   ├── index.html
│   ├── vite.config.ts           dev proxy /api → :4000, "@" alias
│   └── src/
│       ├── app/                 App root, router, 404
│       ├── api/                 typed fetch client and endpoint functions
│       ├── assets/              brand logo and local fonts
│       ├── components/
│       │   ├── ui/              design-system primitives (Button, Badge, Field, Dialog, Sheet, Menu, Toast…)
│       │   └── layout/          AppShell, Sidebar, PageHeader, Logo
│       ├── features/            one folder per product area
│       │   ├── auth/            session provider, route guards, sign-in page
│       │   ├── pipeline/        Kanban board and page
│       │   ├── enquiries/  followups/  brief/  automation/  team/  simulator/
│       │   ├── contact/         contact panel: conversation, reply, details, activity
│       │   ├── intake/          New enquiry dialog
│       │   └── leads/           shared table, toolbar, filters and badges
│       ├── hooks/               TanStack Query hooks, URL-driven contact panel
│       ├── lib/                 formatting (Asia/Dhaka), follow-up rules, helpers
│       ├── styles/              design tokens and base styles
│       └── types/               shared TypeScript types
├── server/                      Express API
│   ├── src/
│   │   ├── index.js             bootstrap: connect, migrate, seed, listen, graceful shutdown
│   │   ├── app.js               Express app and dependency wiring
│   │   ├── config/env.js        validated configuration
│   │   ├── db/                  pool, migration runner, migrations/*.sql, seed, CLI
│   │   ├── middleware/          authentication, roles, validation, same-origin, errors
│   │   ├── modules/             auth, users, leads, intake, automation, reports, simulator, meta, admin
│   │   │                        (each: *.routes.js → *.service.js → *.repository.js)
│   │   ├── domain/lead.js       business rules: stages, phone normalisation, 48-hour rule, validation
│   │   ├── services/ai/         provider calls, prompts, reviewed samples, rule-based fallback
│   │   ├── data/                the 20 supplied sample enquiries
│   │   └── utils/
│   ├── scripts/evaluate-ai.js   live regression run over the 20 samples
│   └── tests/                   unit/ and integration/ (real PostgreSQL)
├── docs/                        submission note, QA, deployment, Loom guide, evidence
├── docker-compose.yml           PostgreSQL (and optional app container)
└── Dockerfile                   multi-stage production image
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | API (watch mode) and Vite dev server together |
| `npm run build` | Type-check and build the client |
| `npm start` | Production server: API + built client on :4000 |
| `npm test` | Server unit and integration tests |
| `npm run typecheck` | Client TypeScript check |
| `npm run check` | Type-check, build and test |
| `npm run db:up` | Start PostgreSQL in Docker |
| `npm run db:migrate` / `db:seed` / `db:reset` | Apply migrations / seed if empty / restore the 20 samples |
| `npm run evaluate:ai -w server` | Run the live AI regression (20 paid calls) |

Integration tests need a database. They use `TEST_DATABASE_URL` (default: the `biai_crm_test` database on the Docker Postgres) and are skipped with a clear message if none is reachable. **The test run drops and recreates the schema of that database,** so never point it at real data.

```bash
docker compose exec db createdb -U biai biai_crm_test
```

## API overview

All routes are under `/api` and, except `/health` and `/auth/login`, need a signed-in session. Errors are `{ "error": { "message": "…" } }`.

| Method & path | Purpose | Role |
|---|---|---|
| `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` | Session | — |
| `GET /meta` | Stages, queues, programmes, channels, samples, AI mode | any |
| `GET /leads`, `GET /leads/:id` | Contacts with messages and activity | any |
| `PATCH /leads/:id` | Edit stage, owner, follow-up, details, reply | any |
| `POST /leads/:id/contact` | Log a completed contact | any |
| `POST /leads/:id/draft` | Draft a new reply | any |
| `DELETE /leads/:id` | Delete a contact | Admin |
| `POST /intake/analyze`, `POST /intake` | Extract details; save a reviewed enquiry | any |
| `GET /automation`, `POST /automation/jobs`, `POST /automation/jobs/:id/review` | Automated intake | any |
| `PUT /automation/settings` | Manual / automatic mode | Admin, Admissions |
| `GET /reports/weekly?end=YYYY-MM-DD` | Weekly brief | any |
| `POST /simulator/messages` | Simulated inbound message | any |
| `GET /users`, `POST /users` | Team list; add a member | any / Admin |
| `POST /admin/reset-demo` | Restore the 20 sample enquiries | Admin |

## Live AI

Set one provider in `.env` and restart: `GEMINI_API_KEY` (+ `GEMINI_MODEL`), or `MODEL_API_KEY` + `META_MODEL` (Meta), or `OPENAI_API_KEY` + `OPENAI_MODEL`. If several are set, Gemini wins, then Meta. Keys stay on the server and are never sent to the browser. The sidebar shows which mode is active.

Extraction uses a strict JSON schema and server-side validation. If a live call fails, the rule-based fallback is used and the result says `Live AI unavailable` so nobody mistakes it for AI output. Weekly totals are always calculated by code; the model only writes the three priorities.

## Documentation

[Submission note](docs/SUBMISSION-NOTE.md) · [QA report](docs/QA.md) · [Requirements audit](docs/REQUIREMENTS-AUDIT.md) · [Deployment](docs/DEPLOYMENT.md) · [Loom guide](docs/LOOM-SCRIPT.md) · [Why this app](docs/WHY-THIS-APP.md) · [Brand notes](docs/BRAND.md)
