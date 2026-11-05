# Task 1 delivery audit

| Employer requirement | Delivered evidence |
|---|---|
| Save name, phone, source, programme, status | PostgreSQL or SQLite contacts, original messages and editable contact form |
| AI extraction from pasted messages | Live structured intake, editable review, persisted corrections |
| English/Banglish replies matching sender | English, Banglish and Bangla; reviewed context and conversation-aware regeneration |
| New / Contacted / Interested / Paid / Lost | Pipeline and stage editor |
| Supplied 20 messages | All 20 retained across 19 contacts; repeat import does not duplicate messages |
| Optional 48-hour reminders | Due queue, explicit dates, owner, next action, urgency, completed-contact logging |
| Optional AI weekly summary | Deterministic totals plus live AI action priorities |
| Code/workflow | Source ZIP or repository; Node 24, `npm install` (bcryptjs, jsonwebtoken, pg) |
| Half-page note | SUBMISSION-NOTE.md |
| Loom up to five minutes | Recording guide prepared; applicant recording remains outstanding |
| Working link if available | Local demo runs; no public deployment provisioned |

## Gaps repaired in the complete functional pass

- Added native HTML5 drag-and-drop to the pipeline board across all 5 stages (New → Contacted → Interested → Paid → Lost) with automatic audit logging and persistence.
- Added quick 1-click stage advancement ("→ Stage") directly on cards.
- Added direct 1-click WhatsApp (`wa.me`) and phone (`tel:`) outreach actions with pre-filled language-matched replies.
- Added multi-provider AI support (Google Gemini, OpenAI, Meta) plus a labelled rule-based fallback for custom messages in Bangla, Banglish, and English when no live AI is available.
- Added 1-click "Log contact" action directly in the Follow-ups table to immediately clear 48-hour reminders without opening modals.
- Enhanced weekly brief with structured executive analysis, admissions priorities, and 1-click copy report.
- Added safe enquiry deletion with confirmation dialog.
- Reviewed repeat intake saves corrected fields and replies.
- Edited replies persist and carry an explicit human-reviewed label.
- Practice demo uses an isolated SQLite database.

## Deliberate boundaries

This is a fictional-data prototype, not a production customer system. Team sign-in records who made each change, but it is not access control: the API is open and roles are labels. No automatic sending, payment verification or channel integration is claimed. Production hosting requires real access controls. AI still requires review. The 20-message extraction result is an in-sample regression, not proof of universal accuracy or superiority to other CRMs.

## Selectable automation

The Automation view offers Manual verification and Automatic with exception review. Submitted messages are extracted and drafted; complete new sales contacts are saved automatically with a 48-hour follow-up. Missing phone/programme, unknown sender, non-sales queues and existing contacts are held for editable approval or rejection. Processing history and settings persist in the database; failed items retain their source and can be retried. Duplicate submissions reuse their job. The supplied-example batch runs sequentially while the page remains open.

This automates submitted intake, not channel collection or outbound delivery. No WhatsApp/Facebook connectors, background message sending, payment verification or autonomous Paid/Lost decisions are implemented. New enquiry in Manual mode retains immediate review; batch results use the verification queue. Sample mode uses labeled reviewed fixtures, not a live model.
