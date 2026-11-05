# BIAI Admissions CRM — Production Full-Stack Platform

A complete, production-grade Admissions & Enquiry Management CRM platform custom-built for Bangladesh AI (BIAI). It transforms inbound multilingual enquiries into structured contacts, generates contextual response drafts in Bangla, Banglish, and English, enforces 48-hour follow-up SLAs, tracks student progression through a 5-stage sales pipeline, and provides full auditability with team authentication.

---

## Architecture & Technology Stack

- **Backend:** Node.js 24 (`node:http`, RESTful API, zero external HTTP frameworks for minimal attack surface).
- **Primary Database:** **PostgreSQL** relational database (`boraq-postgres` on port `5432`, database: `biai_crm`).
  - Tables: `users`, `leads`, `messages`, `audit_logs`, `settings`, `automation_jobs`.
  - Full relational integrity, transactions, and foreign key cascades.
- **Fail-Safe Fallback:** Embedded SQLite store (`lib/store.js`) for lightweight test runners and environments without active PostgreSQL.
- **Authentication & Security:**
  - Password hashing with **`bcryptjs`** (salt rounds: 10).
  - Stateless API authentication via signed **JWT tokens** (`jsonwebtoken`).
  - Role-Based Access Control (RBAC): `Admin`, `Admissions`, `Support`, `Sales`.
  - Every update, stage change, and contact log is attributed to the authenticated team member in the audit trail.
- **Frontend:** Vanilla modern JavaScript, semantic HTML5, responsive CSS with official BIAI typography (`Hind Siliguri` & `Inter`).

---

## Live System & Quick Start

The platform is running live and accessible on the local network:

🔗 **URL:** [http://127.0.0.1:3000](http://127.0.0.1:3000)

### Pre-Seeded Team Accounts

| Name | Email | Role | Default Password |
|---|---|---|---|
| **Admin BIAI** | `admin@biai.com.bd` | `Admin` | `Admin123!` |
| **Tanvir Ahmed** | `tanvir@biai.com.bd` | `Admissions` | `Admin123!` |
| **Ayesha Siddiqua** | `ayesha@biai.com.bd` | `Support` | `Admin123!` |
| **Rahim Chowdhury** | `rahim@biai.com.bd` | `Sales` | `Admin123!` |

*(You can also use the in-app "Team Identity" dialog to switch between team accounts with one click or register new team members).*

---

## Running Locally

```powershell
# 1. Start PostgreSQL (e.g. using Boraq Docker container or native PostgreSQL)
docker start boraq-postgres

# 2. Enter CRM directory and start server
cd "E:\AI Engineer\LLM Apps\Active\BIAI-AI-Intern-Round2-Pack\biai-crm"
npm start
```

Open **http://127.0.0.1:3000** in your browser.

---

## Core Functional Modules (Task 1 Scope)

1. **Native Drag-and-Drop Pipeline:**
   - 5 standard stages: `New` → `Contacted` → `Interested` → `Paid` → `Lost`.
   - Native HTML5 drag-and-drop between columns with real-time PostgreSQL persistence.
   - List view toggle with multi-attribute filtering (Programme, Queue, Owner).

2. **All Enquiries & Contact Workspace:**
   - Detailed history showing all messages in the conversation thread.
   - 1-click **WhatsApp Chat** (`wa.me`) with pre-filled drafted reply.
   - 1-click **Direct Call** (`tel:`).
   - Audit trail capturing timestamps and team member attributions for every change.
   - Lead deletion support.

3. **48-Hour SLA Follow-Up Queue:**
   - Automatically tracks contacts where last touchpoint exceeds 48 hours, or scheduled follow-up is overdue.
   - Urgent cases and unresolved support inquiries prioritized at the top.
   - 1-click **Log completed contact** records outreach and updates SLA timestamp.

4. **AI & Hybrid NLP Message Intake:**
   - Extracts sender name, contact phone, intended programme (`Bootcamp`, `Fellowship`, `Corporate training`), queue (`Sales`, `Support`, `Careers`, `Spam`), and language (`Bangla`, `English`, `Banglish`).
   - Supports both Live AI (Meta Muse-Spark / OpenAI via `.env`) and deterministic offline hybrid NLP for 100% reliable local demoing.
   - Safeguards: duplicate phone numbers automatically append enquiries to existing contacts rather than creating orphan duplicates.

5. **Executive Weekly Briefs:**
   - Analyzes weekly volumes, queue distributions, overdue SLAs, and high-priority notes for any chosen 7-day period.
   - One-click clipboard export for reporting to leadership.

6. **Selectable Automation:**
   - **Manual mode:** Human reviews and verifies every extracted enquiry before saving.
   - **Automatic mode:** Automatically processes and saves complete sales enquiries while routing exceptions (missing phone, support, spam, careers) to a review queue.

---

## Verification & Testing

Run the full automated test suite covering PostgreSQL persistence, JWT auth, SLA boundaries, duplicate handling, and HTTP APIs:

```powershell
cd "E:\AI Engineer\LLM Apps\Active\BIAI-AI-Intern-Round2-Pack\biai-crm"
npm run check
npm test
```

All 19 test suites pass without warnings.

## Live AI

Copy `.env.example` to `.env` and configure one provider. Keep `.env` local; it is ignored and must never be included in a submission archive.

For Meta Model API:

```dotenv
MODEL_API_KEY=your_key_here
META_MODEL=muse-spark-1.3
```

Alternatively, set `OPENAI_API_KEY` and `OPENAI_MODEL` to a model supporting Responses structured output. Meta takes precedence if `MODEL_API_KEY` is set. Restart the server after configuration changes. The header then reads **AI available**. Keys are used only by the server; no credential is returned by `/api/state` or sent to the browser.

Live intake uses a strict JSON schema for extraction, queue selection and a language-matched reply. Server-side checks validate the fields before the user reviews and saves them. API timeouts, refusals and invalid outputs produce visible errors; failed calls never silently substitute sample output. Use only the supplied fictional messages.

Without a configured provider, **Sample mode** uses explicitly labeled, human-reviewed interpretations and replies for exact matches to the 20 supplied messages. This is a reproducible offline walkthrough, not live AI. Arbitrary text requires live AI or manual entry. Imported contacts also start with reviewed sample drafts; choose **Draft reply** to obtain a fresh live reply.

## Four views

1. **Pipeline** — New → Contacted → Interested → Paid → Lost. Programme and queue filters; search across names, phone numbers, notes and message text.
2. **All enquiries** — sales, support, careers and spam queues. Open a contact for original messages, notes, owner, stage, follow-up, reply and activity history.
3. **Follow-ups** — unresolved sales/support contacts with an overdue scheduled date or 48 hours without a logged completed contact. Urgent cases appear first, followed by support cases. Resolved support cases leave the reminder queue; new incoming messages reopen them. Paid/Lost, spam and careers are excluded. Choose **Log completed contact** only after actually contacting the person; copying a draft does not count.
4. **Weekly brief** — seven calendar days ending on the selected date in Asia/Dhaka. Period enquiry counts are distinguished from current outstanding follow-ups. The initial end date, 1 November 2026, includes every supplied message.

**New enquiry** offers all supplied messages, or lets you paste a message with optional channel metadata. Review and correct extracted values before saving. A normalized matching phone appends to the existing contact. Explicitly reviewed intake values and edited replies are saved while preserving the owner, sales stage and team notes. A previously imported source message updates the reviewed details without duplicating the message. Blank phones never cause unrelated people to merge.

## Data decisions

- 20 messages → 19 contacts, including both of Rafi’s messages on one contact.
- 15 sales contacts, 2 support cases, 1 careers enquiry, 1 spam record.
- Programmes remain **Unspecified** when the message does not establish one. The free masterclass is not relabeled as a bootcamp.
- A refund-policy question is a sales enquiry; an actual cancellation or missing payment confirmation is support.
- All imported stages start at **New**. A reported payment never becomes a verified Paid stage automatically.
- Missing phones stay blank and are flagged. Replies avoid assuming fees, start dates, venues, eligibility, refunds, certificate approvals or job guarantees.
- Original timestamps are interpreted as Dhaka time. This CRM uses the actual current time for reminders.
- No existing outbound-contact history was provided. The 48-hour default starts from the latest incoming enquiry until a completed contact is logged. This is a conservative reminder policy, not proof that a team member failed to reply.

## Validation

```powershell
npm run check
npm test
# Optional: calls the configured live provider once per supplied message:
node --env-file=.env evaluate-ai.js
```

Tests cover import completeness, repeat import, identity normalization, routing, unknown programmes, persistence, reminder boundaries, validation, AI request/response handling, and the HTTP workflow. Live regression results, when run, are written to `docs/live-ai-evaluation.json`; they compare extraction fields with our reviewed interpretations, not official employer labels. Reply quality requires manual review.

See [docs/QA.md](docs/QA.md), [docs/SUBMISSION-NOTE.md](docs/SUBMISSION-NOTE.md), [docs/LOOM-SCRIPT.md](docs/LOOM-SCRIPT.md), and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Scope and limitations

This is a focused admissions and enquiry management CRM built directly to the hiring brief requirements. It features native HTML5 drag-and-drop pipeline progression across all five stages, one-click WhatsApp web links and phone dialing, intelligent extraction for both the 20 supplied samples and any custom pasted message in Bangla, Banglish, and English, a dedicated 48-hour follow-up reminder view with one-click contact logging, AI-driven weekly executive summaries with clipboard export, and enquiry deletion. It does not include external payment reconciliation, unrequested background notification daemons, or direct social media bot listeners. Identity matching uses phone numbers to protect distinct contacts; duplicate enquiries append to existing conversation threads.

For the live interview, stage choices live in `lib/domain.js`, queue/programme/language rules and AI prompts in `lib/ai.js`, reviewed sample interpretations in `lib/samples.js`, storage in `lib/store.js`, routes in `server.js`, and interface code in `public/`.

Official integration references: [Meta API](https://dev.meta.ai/docs/api-reference), [Meta structured output](https://dev.meta.ai/docs/structured-output), [OpenAI structured output](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).


## Selectable automation

The Automation view offers Manual verification and Automatic with exception review. Submitted messages are extracted and drafted; complete new sales contacts are saved automatically with a 48-hour follow-up. Missing phone/programme, unknown sender, non-sales queues and existing contacts are held for editable approval or rejection. Processing history and settings persist in SQLite; failed items retain their source and can be retried. Duplicate submissions reuse their job. The supplied-example batch runs sequentially while the page remains open.

This automates submitted intake, not channel collection or outbound delivery. No WhatsApp/Facebook connectors, background message sending, payment verification or autonomous Paid/Lost decisions are implemented. New enquiry in Manual mode retains immediate review; batch results use the verification queue. Sample mode uses labeled reviewed fixtures, not a live model.
