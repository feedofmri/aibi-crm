# BIAI Corporate Outreach Platform: Plan (due Mon 23 Nov)

**Owner:** Samiha Tasnim Diba · **Support:** Jannatul Ferdous, Md. Rubayet Islam · **Reports to:** Hamoody

## 1. The flow (from the whiteboard sketch)

1. **Lead input**: CSV, image, PDF, or voice (see section 3). Everything lands in a review table before it becomes a lead.
2. **AI reads the company** and writes a personal first message. Language is the lead's `language` field, default English, with Banglish as a pick-list option. The AI can suggest a language from the country and contact name, and staff can override it.
3. **Send**: email goes out automatically. WhatsApp goes out only if it can be done safely. Otherwise the platform prepares the message for Trina to copy, send, and mark as sent. The mode is set per campaign: *auto-send* or *review before send*.
4. **Follow-ups**: 2 or 3 timed follow-ups, stopping the moment anyone replies.
5. **Reply** is saved and tagged by AI: `interested`, `not_now`, `wrong_person`, `stop`.
   - `interested`: alert Hamoody by email/WhatsApp with a meeting link.
   - `not_now` / `wrong_person`: continue or re-route, and loop back to step 3.
   - `stop`: opt-out, never contacted again.

## 2. Tools picked, and why

| Part | Choice | Why |
|---|---|---|
| App | React + Express (Node 22) | The team already knows it from the admissions CRM. Parts of the contact, pipeline and follow-up screens can be reused. |
| Database | Own PostgreSQL, standalone, not the ERP | Required by the brief. `tenant_id` on every table for SaaS. |
| AI (writing, tagging, extraction) | Claude API | One vendor for writing English/Banglish, reply tagging, and reading images and PDFs. |
| Speech to text | Whisper-class STT (Bangla + English) | Transcribes uploaded audio and browser-mic recordings. Output is checked by a person before use. |
| Email | SMTP / transactional email on a separate sending domain | Protects BIAI's main domain. Supports opt-out link and reply-tracking. |
| WhatsApp | Manual assisted send first, official WhatsApp Business API later | The brief bans bulk tools that risk a number ban. |
| Jobs | Postgres-backed queue plus a scheduler | Handles follow-ups and a daily send cap without adding Redis. |
| Auth | Email + password, roles per tenant | Several users per company, and each company's data stays separate. |

## 3. Inputs

| Input | How it works | Check before saving |
|---|---|---|
| **CSV** | Upload, map columns, import | Duplicate and bad-email check |
| **Image** (photo of a list, business card, screenshot) | AI vision extracts company, contact, role, email, phone | Staff confirm an editable preview table |
| **PDF** (company list, brochure, directory) | Text extraction first, then AI vision for scanned pages | Same preview table |
| **Voice file / live recording** | Audio upload or browser mic, then transcript. Either (a) AI pulls lead details from a dictated note, or (b) it logs a call/voice reply against an existing lead. | Staff see the transcript and any extracted fields before saving |

All four feed one pipeline: **extract, preview, confirm, store**. Voice replies arriving on WhatsApp are transcribed and then tagged like any other reply.

## 4. Build order

1. **Foundation**: tenants, users, roles, database schema, opt-out rule.
2. **Lead input**: CSV import with preview, then image and PDF extraction, then voice transcript.
3. **First-message writer**: English/Banglish templates, a prototype with 3 samples, and Hamoody's approval gate.
4. **Email send**: separate inbox, daily cap, opt-out link, and a "sent" log.
5. **Reply capture and AI tagging**, then the `interested` alert with a meeting link.
6. **Follow-up scheduler**: 2 or 3 steps, stopping on reply or opt-out.
7. **WhatsApp assisted-send queue** for Trina.
8. **Pilot on 20 test leads.**

Later, once the core works: dashboard, lead scoring, proposal drafts, billing, public SaaS launch.

## 5. Fields the platform stores

**Tenant / User**: `tenant_id`, name, settings (daily cap, sender identity, language default) · user: email, role.

**Company**: id, `tenant_id`, name, website, industry, size, country, notes.

**Contact**: id, company_id, name, role, email, phone/WhatsApp, `language` (English/Banglish), `status` (new, queued, sent, replied, interested, not_now, wrong_person, stopped), `opted_out` (boolean + timestamp).

**Lead source**: `source_type` (csv/image/pdf/voice/manual), original file reference, extraction confidence, who confirmed it.

**Campaign / Template**: id, name, channel, send mode (auto / review), template text, `approved_by`, `approved_at`.

**Message**: id, contact_id, channel (email/whatsapp), direction, `body`, `language`, `status` (draft, approved, sent, failed), `sent_at`, `sent_by` (system or Trina), `sequence_step` (0 = first, 1 to 3 = follow-ups).

**Reply**: id, contact_id, body, `source` (text or voice), transcript, `ai_tag`, tag confidence, `tag_override_by`, `received_at`.

**Follow-up**: contact_id, step, `due_at`, state (scheduled, sent, cancelled).

**Alert**: contact_id, sent_to, meeting_link, channel, `sent_at`.

**Audit log**: who changed what, and when.

## 6. Guardrails

- Nothing goes to a real company until Hamoody approves the templates.
- Every message carries an opt-out. An opted-out contact is blocked at send time by code, not by the AI.
- Separate sender email, small daily volumes, and no bulk WhatsApp tools.
- Messages never contain prices, discounts or promises unless approved.
- Extracted or transcribed data is always confirmed by a person before it becomes a lead.

## 7. Needed from the team

The company list from Trina, a test email inbox, a test WhatsApp number, the pricing sheet, and a time slot with Trina for the WhatsApp test.
