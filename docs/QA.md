# Validation report

Validated on 5 November 2026 with Node.js 22 and PostgreSQL 16 on Linux, after the rebuild to a React client, an Express API and PostgreSQL.

## Automated checks

| Check | Result |
|---|---|
| `npm run typecheck` (CRM and simulator, TypeScript strict) | passed |
| `npm run build` (CRM and simulator) | passed |
| `npm test` (server, against a real PostgreSQL test database) | **37 passed, 0 failed** |

What the tests cover:

- **Domain rules:** Bangladesh phone normalisation (including Bangla digits), the 48-hour boundary to the millisecond, scheduled follow-ups taking precedence, exclusion of paid, lost, spam, careers and resolved support contacts, validation errors.
- **AI layer (mocked, no paid calls):** reviewed sample mode for all 20 messages, rule-based fallback, strict-schema request contract, provider errors (429, incomplete, invalid JSON, invalid fields), Meta endpoint and server-only key, reply drafting with the full conversation and chosen language, weekly-priority fallback with a visible notice, and no unconfirmed course details in rule-based replies.
- **Authentication and roles:** every CRM route returns 401 without a session; the httpOnly SameSite cookie; no password hash in responses; only Admin adds members or deletes contacts; only Admin or Admissions change automation mode; cross-site state changes are refused.
- **Contacts and intake:** 20 messages import as 19 contacts (15 sales, 2 support, 1 careers, 1 spam), all at New, six without phones and never merged, Habibur urgent; re-importing duplicates nothing; reviewed intake of a supplied message updates without duplicating; sample ids must match their message; a new phone creates a contact and the same phone later joins it; edits are validated (stage, phone, unknown fields), attributed to the signed-in person and described in plain words; phone conflicts return 409; logging contact moves New to Contacted and keeps future scheduled dates; resolved support cases reopen on a new message; spam never gets a reply; weekly totals are calculated (20 messages in the week ending 1 Nov 2026) and empty weeks work; admins can restore the samples.
- **Inbound channel API (simulator site):** requires the channel key (a staff session alone is refused), CORS only for the simulator's origin, an inbound message is saved like a real enquiry and the same phone joins the existing contact, the response is a summary without internal CRM history, and activity is credited to the channel simulator.
- **Automation:** automatic mode saves complete sales enquiries with a 48-hour follow-up and reuses duplicate jobs; exceptions (missing phone, support) wait for review and can be edited, approved or rejected; approval never marks progress; provider failures keep the input, create nothing and can be retried; manual mode holds everything.

## Browser verification

Run end to end against PostgreSQL in Chromium at 1440 × 900 and iPhone 13 size:

- Sign-in page, one-click demo accounts, redirect back to the requested page.
- Pipeline board with all five stages visible at laptop width; list view; filters; stage change by drag and drop.
- All enquiries with queue tabs and counts; Follow-ups grouped Urgent → Support → Sales with aligned columns and **Log contact**.
- Contact panel: conversation first, reply composer, activity, details form with a save bar that appears only for unsaved changes; support and spam callouts.
- New enquiry: Tahmina's supplied message → reviewed sample with missing-phone warning and Bangla reply → saved to the existing contact.
- Weekly brief, Automation (processing all 20 samples, reviewing an exception), Team.
- Channel simulator as its own site on :5174: connection status, WhatsApp and Messenger conversations, drafted reply bubbles, result card with a link into the CRM; the new contact appears in the CRM pipeline; the CRM sidebar links to the simulator.
- Mobile: navigation drawer, stacked stat cards, full-screen contact panel, simulator with the chat first.
- No console errors apart from the expected 401 when checking the session before sign-in.

## Production build and deployment rehearsal

- The cPanel bundle (`npm run bundle`: 21 files, API in one `server.mjs`) was run from a folder with no `node_modules`, in production mode, loading settings from `~/biai.env`, against a fresh PostgreSQL database: migrations, seeding and both web apps worked.
- The simulator was built for production (CRM URL and channel key compiled in) and served from a different origin; the full browser run (sign-in, every CRM page, intake, follow-ups, automation, simulator → CRM) passed with no console errors besides the expected pre-sign-in session check.
- The deploy workflow's FTPS upload commands were run against a local FTPS server: stale files were deleted, `.htaccess` and `stderr.log` were kept, and the uploaded copy started and passed the workflow's smoke tests (health, both web apps, CORS, wrong key refused, data needs a session).
- PostgreSQL 12 (common on cPanel, lacks a built-in `gen_random_uuid()`): CI runs the full suite on PostgreSQL 12 and 16. The first CI run caught that the fallback's ids were not valid version-4 UUIDs (the API rejects those); the fallback now produces proper v4 ids, verified with 2,000 samples and the full suite running on the fallback.
- Not yet verified on the real cPanel server: that needs the one-time setup in `cpanel-setup.md` and the GitHub secrets.

## Real AI regression check (earlier version, same prompts)

The extraction prompt was run against all 20 supplied messages with **Meta Model API / muse-spark-1.3**. All 20 calls succeeded. Name, phone, programme, queue and language each matched our reviewed baseline on **20/20** messages. See `evidence/live-ai-evaluation.json` and `evidence/live-reply-check.json`.

The baseline is our interpretation of the sample messages, not official BIAI labels. The same samples informed prompt development, so this is a regression check, not a held-out accuracy benchmark. Extraction agreement does not measure reply quality; replies were read for relevance, language and unsupported claims. Re-run with `npm run evaluate:ai -w server` after configuring a key.

## Known limitations

- Nothing is sent from the app; there are no live WhatsApp or Facebook connections.
- Payments are never verified by the app.
- Reminders are in-app only (no email or push).
- Without an AI key, new messages use a much weaker rule-based extractor (clearly labelled).
- Demo accounts share a published password; change it before any public deployment.
