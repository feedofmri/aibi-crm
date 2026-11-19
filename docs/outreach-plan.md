# BIAI Corporate Outreach Platform: Plan (due Mon 23 Nov)

**Owner:** Samiha Tasnim Diba · **Support:** Jannatul Ferdous, Md. Rubayet Islam · **Reports to:** Hamoody

**Approach:** we extend the current BIAI CRM (React + Express + PostgreSQL) instead of starting a new app. It is already a standalone app with its own database, not inside the ERP, as the brief requires. The admissions CRM is *inbound* (people write to us). This work adds an *outbound* side (we write to companies) on the same foundation.

## 1. The flow (from the whiteboard sketch)

1. **Lead input:** CSV, image, PDF, or voice (section 3). Everything lands in a review table before it becomes a lead.
2. **AI reads the company** and writes a personal first message. Language is the lead's `language` field (English default, Banglish selectable). The AI may suggest one, and staff can override it.
3. **Send:** email goes out automatically. WhatsApp goes out only if it can be done safely. Otherwise the platform prepares the message for Trina to copy, send and mark as sent. Each campaign is either *auto-send* or *review before send*.
4. **Follow-ups:** 2 or 3 timed follow-ups, stopping the moment anyone replies.
5. **Reply** is saved and tagged by AI: `interested`, `not_now`, `wrong_person`, `stop`.
   - `interested`: alert Hamoody by email or WhatsApp with a meeting link.
   - `not_now` / `wrong_person`: continue or re-route, looping back to step 3.
   - `stop`: opted out, never contacted again.

## 2. What we reuse, extend and add

| Area | Already in the project | Change for outreach |
|---|---|---|
| Stack | React client, Express 5 API (Node 22), PostgreSQL with SQL migrations, Docker | Keep. Add migrations `003+`. |
| Leads and pipeline | `leads` table, five-stage board, contact panel, activity log | Add a **companies** layer above contacts, plus outreach statuses (queued, sent, replied, opted out). |
| Messages | `messages` with direction (inbound/outbound) and delivery (auto/manual) | Add channel `email`, a `sequence_step`, `language`, and approval fields. |
| AI | `services/ai` with Gemini/Meta/OpenAI providers, retries, timeouts, policy checks, evaluation script | Keep the provider layer. Add tasks: write first message, tag reply, extract leads from image/PDF, transcribe audio. |
| Safety | Reply policy check (no prices, dates, guarantees, outside links) | Reuse as-is on outbound drafts. Add opt-out enforcement. |
| Automation | Manual/automatic modes, held exceptions, off-by-default auto-reply | Reuse as the per-campaign *auto-send / review* switch. |
| Follow-ups | 48-hour and scheduled follow-up page | Extend into a **timed sequence scheduler** (2 or 3 steps, cancelled on reply or opt-out). |
| Auth and roles | JWT login, Admin/Admissions/Support/Sales | Add `tenant_id` to users and all data tables (SaaS). Keep roles per tenant. |
| Simulator | Separate site that posts to the inbound API | Extend to simulate company replies (text and voice) for the pilot. |

**New pieces:** lead import (CSV/image/PDF/voice), email sender, reply capture, speech-to-text, the sequence scheduler, the `interested` alert with meeting link, and opt-out handling.

**Tools:** Gemini is already the first provider in `provider.js`. It reads images, PDFs and audio, so one provider can cover writing, tagging, extraction and transcription. The team will test Bangla/Banglish quality on sample data before relying on it, and can swap providers because the layer is already abstracted. Email goes through SMTP or a transactional service on a separate sending domain. WhatsApp is manual assisted send first (Trina), because the brief bans bulk tools. Jobs run on a Postgres-backed queue plus a scheduler, with no new infrastructure.

## 3. Inputs

| Input | How it works | Check before saving |
|---|---|---|
| **CSV** | Upload, map columns, import | Duplicate and bad-email check |
| **Image** (photo of a list, business card, screenshot) | AI vision extracts company, contact, role, email, phone | Staff confirm an editable preview table |
| **PDF** (company list, brochure, directory) | Text extraction first, AI vision for scanned pages | Same preview table |
| **Voice file / live recording** | Audio upload or browser mic, then transcript. Either (a) lead details are pulled from a dictated note, or (b) it is logged as a call or voice reply on an existing lead. | Staff see the transcript and extracted fields before saving |

All four feed one pipeline: **extract, preview, confirm, store.** Voice replies arriving on WhatsApp are transcribed, then tagged like any other reply.

## 4. Build order (on the existing repo)

1. **Foundation:** migrations for tenants, companies and outreach fields, with `tenant_id` and opt-out rules.
2. **Lead input:** CSV import with preview, then image/PDF extraction, then voice transcript.
3. **First-message writer:** English/Banglish templates, 3 sample messages in the prototype, and Hamoody's approval gate.
4. **Email send:** separate inbox, daily cap, opt-out link, "sent" log.
5. **Reply capture and AI tagging**, then the `interested` alert with a meeting link.
6. **Sequence scheduler:** 2 or 3 steps, stopping on reply or opt-out.
7. **WhatsApp assisted-send queue** for Trina.
8. **Pilot on 20 test leads.**

Later, once the core works: dashboard, lead scoring, proposal drafts, billing, public SaaS launch.

## 5. Fields to store

Existing `leads` fields (name, phone, language, status, owner, notes, `next_follow_up`, `last_contact_at`, draft) are kept. The new fields are marked **new**.

**Tenant** (new): id, name, settings (daily cap, sender identity, default language).

**Company** (new): id, `tenant_id`, name, website, industry, size, country, notes.

**Contact** (extends `leads`): `company_id` (new), `tenant_id` (new), role (new), email (new), `status` plus outreach states (new), `opted_out` + timestamp (new).

**Lead source** (new): `source_type` (csv/image/pdf/voice/manual), original file reference, extraction confidence, confirmed by.

**Campaign / Template** (new): id, name, channel, send mode (auto/review), template text, `approved_by`, `approved_at`.

**Message** (extends `messages`): `channel` adds email, `sequence_step` (0 = first, 1 to 3 = follow-ups), `language`, status (draft/approved/sent/failed), `sent_at`, `sent_by`.

**Reply** (extends inbound `messages`): `source` (text/voice), `transcript`, `ai_tag`, tag confidence, `tag_override_by`.

**Follow-up** (new): contact_id, step, `due_at`, state (scheduled/sent/cancelled).

**Alert** (new): contact_id, sent_to, meeting_link, channel, `sent_at`.

**Audit log:** the existing `activity_log` is kept.

## 6. Guardrails

- Nothing goes to a real company until Hamoody approves the templates.
- Every message carries an opt-out. An opted-out contact is blocked at send time by code, not by the AI.
- Separate sender email, small daily volumes, and no bulk WhatsApp tools.
- No prices, discounts or promises unless approved (the existing policy check enforces this).
- Extracted or transcribed data is always confirmed by a person before it becomes a lead.

## 7. Needed from the team

The company list from Trina, a test email inbox, a test WhatsApp number, the pricing sheet, and a time slot with Trina for the WhatsApp test.
