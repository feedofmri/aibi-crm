# Validation report

Validated on 3 November 2026 with Node.js 24.18.0 on Windows.

## Automated checks

- JavaScript syntax checks: passed.
- `node --test`: **16 tests passed, 0 failed**.
- All 20 original source IDs survive import; 19 unique contacts, 15 sales, 2 support, 1 careers and 1 spam.
- Repeat import is idempotent, including the six contacts without a phone. Rafi’s two enquiries remain on one contact.
- SQLite reopen preserves edits. Phone normalization supports Bangladesh prefixes and Bangla digits.
- 48-hour boundary, scheduled follow-up precedence, completed-contact timing, and exclusions for Paid/Lost/spam/careers are checked.
- Invalid phone numbers, duplicate-contact phone edits and invalid stages are rejected.
- AI schema configuration, Meta/OpenAI endpoints, provider errors, invalid JSON and invalid fields are tested with mocks. These tests make no external model calls.
- HTTP integration checks extraction, review/save, stage edits, reply generation, contact logging, period summaries, same-origin protection, missing records and the entry page.

Additional checks cover reviewed repeat-intake persistence, edited reply storage, support resolution/reopening, future scheduled dates retained after contact logging, and isolation of the empty practice workspace. Local HTTP tests require loopback network permission in restricted environments.

## Real AI regression check

The final prompt was run against all 20 supplied messages with **Meta Model API / muse-spark-1.3**. All 20 calls succeeded. Name, phone, programme, queue and language each matched our reviewed baseline on **20/20** messages. See `live-ai-evaluation.json` for full outputs and timings.

The baseline is our interpretation of the sample messages, not official BIAI ground truth. The same samples informed prompt development, so this is a regression check, not a held-out accuracy benchmark. Extraction agreement does not measure reply quality. Replies were also read for relevance, language and unsupported claims, with particular attention to missing confirmation, cancellation/refund, certificate approval, eligibility and recruitment. Human review is still necessary.

The Meta key was checked against the official model catalog. It is stored only in the ignored local `.env`; the ZIP explicitly excludes it. No key or database is needed to run the labeled offline sample mode.

## Browser verification

- Default desktop viewport: pipeline, cards, filters, contact form and brand assets rendered.
- Message intake: sample selection populates source metadata and original Bangla text; extraction returns editable fields, missing phone and a Bangla draft.
- Repeat intake opens the existing Tahmina contact with one original message.
- Stage and owner edits persisted across a full page reload. Test values were restored to New/unassigned afterward; the activity log records those actual test edits.
- Weekly brief includes 20 messages in the seven-day window ending 1 November 2026; a different empty window is also covered by integration tests.
- Live Meta weekly summary returned successfully. The summary prompt was then tightened to a 150-word team brief.
- Responsive check at 390 × 844: sidebar becomes top navigation, metrics use two columns, intake remains available, and document width stays within the viewport. The board scrolls within its own area.
- Final theme follows the supplied light Courses/About references: official logo, local Inter/Hind Siliguri fonts, ivory paper, white cards and burnt-orange pill buttons. No cinematic background treatment.

## Remaining delivery steps

- Record the applicant’s own Loom presentation, maximum five minutes, using `LOOM-SCRIPT.md`.
- A public hosting account and public URL have not been provisioned. The working link is local to the development computer; `DEPLOYMENT.md` explains reviewer setup and hosting requirements.
- Production authentication, channel integrations, payment verification and background notifications are outside this prototype’s scope.

The live weekly brief was further adjusted after a model mislabeled message volume as contact volume: code now writes the numeric summary, while AI generates only the three action priorities. This keeps the counts deterministic.

Final improvement pass: browser-verified live intake in the isolated practice workspace, edited Bangla reply and next-action persistence after full reload. Three live conversation-aware reply checks are saved in `live-reply-check.json`; the missing-phone prompt was refined after review and Tahmina was rerun successfully. The API contract test verifies both Rafi messages and the selected language are supplied to reply regeneration.

## Selectable automation

The Automation view offers Manual verification and Automatic with exception review. Submitted messages are extracted and drafted; complete new sales contacts are saved automatically with a 48-hour follow-up. Missing phone/programme, unknown sender, non-sales queues and existing contacts are held for editable approval or rejection. Processing history and settings persist in SQLite; failed items retain their source and can be retried. Duplicate submissions reuse their job. The supplied-example batch runs sequentially while the page remains open.

This automates submitted intake, not channel collection or outbound delivery. No WhatsApp/Facebook connectors, background message sending, payment verification or autonomous Paid/Lost decisions are implemented. New enquiry in Manual mode retains immediate review; batch results use the verification queue. Sample mode uses labeled reviewed fixtures, not a live model.

Live browser automation check: Rafi was automatically extracted, drafted, saved and given a follow-up in the practice workspace. Tahmina was held for missing-phone/existing-contact verification, then manually approved without duplicating her message. Main sample contacts were not changed. Existing-contact reviews preserve the original reminder timing.
