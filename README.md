# BIAI Admissions CRM

A working prototype of an admissions and enquiry CRM for Bangladesh AI (BIAI), built on the 20 supplied fictional messages. It transforms inbound multilingual enquiries into structured contacts, generates contextual response drafts in Bangla, Banglish, and English, enforces 48-hour follow-up SLAs, tracks student progression through a 5-stage sales pipeline, and provides full auditability with team authentication.

---

## Architecture & Technology Stack

- **Backend:** Node.js 24 (`node:http`, RESTful API, zero external HTTP frameworks for minimal attack surface).
- **Database:** PostgreSQL when `DATABASE_URL` is reachable (`lib/pgstore.js`: `users`, `leads`, `messages`, `audit_logs`, `settings`, `automation_jobs`). Otherwise it falls back automatically to Node's built-in SQLite (`lib/store.js`, `data/crm.sqlite`), so it runs with no database setup.
- **Team identity:** team members sign in (bcrypt password hashes, JWT tokens) and stage changes and contact logs are attributed to them in the activity history. Roles (`Admin`, `Admissions`, `Support`, `Sales`) are labels only. **This is attribution, not access control:** the CRM API does not require a token and the UI signs in as the demo Admin automatically. Do not expose it publicly without adding real access control (see `docs/DEPLOYMENT.md`).
- **Frontend:** Vanilla modern JavaScript, semantic HTML5, responsive CSS with official BIAI typography (`Hind Siliguri` & `Inter`).

---

## Quick start

```bash
npm install
npm start
```

Open http://127.0.0.1:3000. This address works only on the computer running the server. Without PostgreSQL the server logs a fallback message and uses SQLite.

### Demo team accounts (fictional)

| Name | Email | Role | Default Password |
|---|---|---|---|
| **Admin BIAI** | `admin@biai.com.bd` | `Admin` | `Admin123!` |
| **Tanvir Ahmed** | `tanvir@biai.com.bd` | `Admissions` | `Admin123!` |
| **Ayesha Siddiqua** | `ayesha@biai.com.bd` | `Support` | `Admin123!` |
| **Rahim Chowdhury** | `rahim@biai.com.bd` | `Sales` | `Admin123!` |

*(You can also use the in-app "Team Identity" dialog to switch between team accounts with one click or register new team members).*

---

To use PostgreSQL instead, set `DATABASE_URL=postgresql://user:password@host:5432/biai_crm` in `.env` before `npm start`.

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
   - Uses live AI (Gemini, Meta or OpenAI, configured in `.env`) when available. Without a key, the 20 supplied messages use reviewed sample interpretations and any other message uses a simpler rule-based extractor, clearly labelled **Rule-based** in the UI.
   - Safeguards: duplicate phone numbers automatically append enquiries to existing contacts rather than creating orphan duplicates.

5. **Weekly brief:**
   - Code calculates the totals for any 7-day period. Live AI writes three action priorities; without AI, rule-based priorities are built from the same data and labelled as such.
   - One-click clipboard export for reporting to leadership.

6. **Selectable Automation:**
   - **Manual mode:** Human reviews and verifies every extracted enquiry before saving.
   - **Automatic mode:** Automatically processes and saves complete sales enquiries while routing exceptions (missing phone, support, spam, careers) to a review queue.

---

## Verification & Testing

Run the full automated test suite covering PostgreSQL persistence, JWT auth, SLA boundaries, duplicate handling, and HTTP APIs:

```bash
npm run check
npm test
```

19 tests: 17 always run; the 2 PostgreSQL tests are skipped automatically unless `DATABASE_URL` points to a running PostgreSQL server.

## Live AI

Copy `.env.example` to `.env` and configure one provider (Gemini, Meta or OpenAI; if several keys are set, Gemini is used first, then Meta, then OpenAI). Keep `.env` local; it is ignored and must never be included in a submission archive.

For Meta Model API:

```dotenv
MODEL_API_KEY=your_key_here
META_MODEL=muse-spark-1.3
```

Alternatively, set `GEMINI_API_KEY`, or `OPENAI_API_KEY` and `OPENAI_MODEL` (a model supporting Responses structured output). Restart the server after configuration changes. The header then reads **AI available**. Keys are used only by the server; no credential is returned by `/api/state` or sent to the browser.

Live intake uses a strict JSON schema for extraction, queue selection and a language-matched reply. Server-side checks validate the fields before the user reviews and saves them. If a live call fails or returns invalid fields, the result falls back to the rule-based extractor and the reason starts with `[Live AI unavailable: …]`, so the reviewer can see it was not live AI. Use only the supplied fictional messages.

Without a configured provider, **Sample mode** uses explicitly labeled, human-reviewed interpretations and replies for exact matches to the 20 supplied messages. This is a reproducible offline walkthrough, not live AI. Other text uses the labelled rule-based extractor or manual entry. Imported contacts also start with reviewed sample drafts; choose **Draft reply** to obtain a fresh live reply.

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

```bash
npm run check
npm test
# Optional: calls the configured live provider once per supplied message:
node --env-file=.env evaluate-ai.js
```

Tests cover import completeness, repeat import, identity normalization, routing, unknown programmes, persistence, reminder boundaries, validation, AI request/response handling, and the HTTP workflow. Live regression results, when run, are written to `docs/live-ai-evaluation.json`; they compare extraction fields with our reviewed interpretations, not official employer labels. Reply quality requires manual review.

See [docs/QA.md](docs/QA.md), [docs/SUBMISSION-NOTE.md](docs/SUBMISSION-NOTE.md), [docs/LOOM-SCRIPT.md](docs/LOOM-SCRIPT.md), and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Scope and limitations

This is a focused admissions and enquiry management CRM built directly to the hiring brief requirements. It does not send messages, verify payments, connect to WhatsApp/Facebook directly, or enforce role-based access. Reminders are in-app only. Identity matching uses phone numbers to protect distinct contacts; duplicate enquiries append to existing conversation threads.

For the live interview, stage choices live in `lib/domain.js`, queue/programme/language rules and AI prompts in `lib/ai.js`, reviewed sample interpretations in `lib/samples.js`, storage in `lib/pgstore.js` (PostgreSQL) and `lib/store.js` (SQLite fallback), routes in `server.js`, and interface code in `public/`.

Official integration references: [Meta API](https://dev.meta.ai/docs/api-reference), [Meta structured output](https://dev.meta.ai/docs/structured-output), [OpenAI structured output](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).


## Selectable automation

The Automation view offers Manual verification and Automatic with exception review. Submitted messages are extracted and drafted; complete new sales contacts are saved automatically with a 48-hour follow-up. Missing phone/programme, unknown sender, non-sales queues and existing contacts are held for editable approval or rejection. Processing history and settings persist in the database; failed items retain their source and can be retried. Duplicate submissions reuse their job. The supplied-example batch runs sequentially while the page remains open.

This automates submitted intake, not channel collection or outbound delivery. No WhatsApp/Facebook connectors, background message sending, payment verification or autonomous Paid/Lost decisions are implemented. New enquiry in Manual mode retains immediate review; batch results use the verification queue. Sample mode uses labeled reviewed fixtures, not a live model.
