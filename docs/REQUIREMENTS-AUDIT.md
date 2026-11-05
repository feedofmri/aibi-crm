# Task 1 delivery audit

| Employer requirement | Delivered evidence |
|---|---|
| Save name, phone, source, programme, status | PostgreSQL contacts with original messages, editable in the contact panel |
| AI extraction from pasted messages | New enquiry: structured extraction, human review, saved corrections |
| English/Banglish replies matching sender | English, Banglish and Bangla drafts; regenerate with the full conversation |
| New / Contacted / Interested / Paid / Lost | Drag-and-drop pipeline and stage field, every change in the activity history |
| Supplied 20 messages | All 20 kept across 19 contacts; re-import duplicates nothing |
| Optional 48-hour reminders | Follow-ups page grouped by urgency, scheduled dates, owner, next action, Log contact |
| Optional AI weekly summary | Calculated totals plus three AI (or rule-based) priorities, copyable |
| Code/workflow | Repository: `client/` (CRM, React + TypeScript), `simulator/` (channel simulator site), `server/` (Express + PostgreSQL), tests, Docker |
| Half-page note | `SUBMISSION-NOTE.md` |
| Loom up to five minutes | `LOOM-SCRIPT.md`; recording by the applicant |
| Working link if available | Runs locally; hosting steps in `DEPLOYMENT.md` |

## Beyond the brief

- Team sign-in with roles enforced on the API (Admin, Admissions, Support, Sales).
- Automation mode: complete sales enquiries saved automatically, exceptions held for review.
- Channel simulator as a separate website, posting to an authenticated inbound channel API: the same shape a real WhatsApp or Facebook webhook would use.
- Restore-sample-data action for repeatable demos.
- Responsive layout for phones.

## Deliberate boundaries

This is a fictional-data prototype. No automatic sending, payment verification or channel integration is claimed. AI output always needs review. The 20/20 extraction result is an in-sample regression, not a general accuracy claim.
