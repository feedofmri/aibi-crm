# Loom recording guide — target 4:30, hard limit 5:00

Record your own screen and explanation in your own words. This is an outline, not a script to read. Rehearse once with a timer; if you run long, cut from section 2, never from sections 3 and 4.

## Before recording

- `npm install`, `npm start`, open http://127.0.0.1:3000. Close other tabs; hide any terminal or editor that shows `.env`.
- Decide live AI or not. If a key is configured, the header shows **AI Live**; otherwise **Hybrid NLP**. Say which one you are using. Never present a rule-based or reviewed-sample result as live AI.
- Use only the supplied sample data. Use the **Practice demo** workspace for intake so the main sample data stays intact.
- Readable zoom (110–125%). Microphone check.

## 1. 0:00–0:30 — Task and problem

“I picked the **BIAI admissions CRM** task. BIAI gets enquiries on WhatsApp, Facebook, forms and calls in Bangla, Banglish and English; the problem is losing context and forgetting the next reply. I built one workspace that turns those messages into reviewed contacts and makes the next action obvious.”

Show the pipeline: 20 supplied messages → 19 contacts. No invented customers.

## 2. 0:30–3:00 — Live walkthrough (main flow first)

1. **Intake (0:30–1:20).** New enquiry → pick **#2 Tahmina** → Extract details & draft reply. Point out: fellowship detected, phone missing, Bangla reply asking for a number. Edit one sentence, save. Reopen the contact: the edit persisted, and the label says **Human-reviewed**.
2. **Pipeline (1:20–1:45).** Drag a card from New to Contacted. Open the contact: activity history shows who changed it and when. Show the WhatsApp button (pre-filled draft) — it opens a chat, the app doesn’t send anything itself.
3. **Messy data (1:45–2:20).** All enquiries → search **Rafi**: two messages, one contact (phone normalisation; blank phones never merge). Search **Farzana**: says she paid → routed to Support, *not* marked Paid. “A payment claim needs a human.”
4. **Follow-ups (2:20–2:40).** 48-hour rule, urgent first, Paid/Lost/spam/careers excluded. **Log completed contact** only after actually contacting the person.
5. **Weekly brief (2:40–3:00).** Week ending 1 Nov 2026 → Create report. Totals are calculated by code; AI (or the labelled rule-based fallback) only writes the priorities.

## 3. 3:00–4:15 — How I used AI to build it, and what I decided

Show the code briefly (`lib/ai.js` prompt, `lib/domain.js`, tests).

- **Which tools and how** — name the tools you actually used (for example, a coding agent for building and debugging, a chat model for reading the brief and drafting prompts). Be concrete: one thing AI wrote well, one thing you had to correct.
- **AI inside the product:** structured JSON output with a strict schema, so the model returns fields instead of free text; server-side validation rejects invalid output.
- **Decisions you made, not the AI:** a payment claim never sets Paid; unknown programme stays Unspecified; replies never invent prices, dates or venues; code — not the model — does identity matching, dates and counts (you moved weekly totals out of the AI after it mislabelled messages as contacts).
- **Evidence:** automated tests, plus a live run over all 20 messages (`docs/live-ai-evaluation.json`). Say honestly that it’s an in-sample regression check, not an accuracy benchmark.

## 4. 4:15–4:50 — What doesn’t work yet and what I’d fix next

“Team sign-in records who changed what, but it isn’t access control yet: the API is open and roles are labels. It doesn’t send messages, verify payments or connect to WhatsApp directly, and reminders are in-app only. Without an AI key the fallback is rule-based and much weaker. Next I’d enforce sign-in and roles on the API, add approved programme and fee information so replies can actually answer, then a reviewed WhatsApp integration.”

Close: “The team can see who this person is, what we know, and what to do next — without losing the original message.”

## Submission checklist

- Loom ≤ 5:00, readable text and audio. Watch it back once.
- Reply to the same email with: Loom URL, demo URL (only if verified from another device — localhost is not a demo link), repository or ZIP, and the half-page note (`SUBMISSION-NOTE.md`).
- Exclude `.env`, database files, keys and logs. `package-submission.ps1` builds the ZIP from an allowlist.
- Quote accuracy only as stated in `QA.md`. Revoke any temporary API key after the demo.
