# Loom recording guide — target 4 minutes 30 seconds

Record your own screen and explanation. The brief scores your ability to explain and sell the work. This outline is not a recording. Rehearse in your own words and keep the final Loom below five minutes.

## Before recording

- Start `npm start`, open http://127.0.0.1:3000, close other tabs and hide any terminal or editor showing `.env`.
- Configure and verify live AI first if available. The badge must accurately reflect whether live AI is connected.
- Know the difference between the reviewed drafts loaded with sample data and a freshly generated live draft.
- Keep the screen at a readable zoom. The board scrolls horizontally on smaller screens.
- Leave all source data intact. During the demo, make intentional stage/owner changes and explain them as demo actions.

## 0:00–0:30 — Problem and promise

“BIAI receives enquiries across WhatsApp, Facebook, forms and calls. The problem is losing the context and forgetting the next reply. I built one small workspace that turns those conversations into reviewed contacts and makes the next action clear.”

Show the pipeline and metrics. Explain: 20 supplied messages, 19 contacts. No invented customers or conversions.

## 0:30–1:40 — Show AI doing useful work

Open **New enquiry** and choose **#2, Tahmina**. Explain that channel metadata supplies the name, while the message establishes fellowship interest. Click **Extract details & draft reply**. Point out the Bangla reply, blank phone and request for a contact number. Say which live provider is being used. If offline, state that the reviewed sample is a fallback and explain the configuration needed for live AI.

Edit one sentence of the reply and save. Reopening the contact proves the reviewed result persists. Re-importing an existing source message updates the reviewed fields without duplicating its message. Use the separate **Practice demo** workspace to demonstrate this from an empty contact list. Change the owner and stage deliberately, save, and explain that the team remains in control.

## 1:40–2:30 — Show judgment on messy data

Close the contact; open **All enquiries** and search **Rafi**. Show the two original messages on one contact. Explain phone normalization and why blank phones are never merged.

Search **Farzana**. Show support routing and the payment complaint. “She says she paid; the app does not verify that and does not mark her Paid. This needs a human.” Show the support Open/Resolved control: resolution removes the reminder without pretending this is a sales conversion.

Briefly mention spam and careers queues. If time permits, show **Sabbir**: programme remains unspecified because it is absent from the message.

## 2:30–3:15 — Make the next action obvious

Open **Follow-ups**, with all queues selected. Explain the 48-hour rule and that paid/lost leads, spam and careers are excluded. Show how an owner can schedule a next follow-up. Show urgency, owner and next action. Explain **Log completed contact**: use it after reaching out through the original channel; merely copying a reply does not pretend contact happened.

## 3:15–3:50 — Weekly brief

Open **Weekly brief**, ending **1 November 2026**, and generate. Explain that this window contains the sample enquiries, while overdue totals describe the current workspace. Point out the distinction between a live AI summary and deterministic sample mode.

## 3:50–4:30 — Choices, evidence and limitations

“I kept the app to four views and used Node’s built-in SQLite so it runs with one command and preserves changes. AI handles language and intent; code handles identity, dates, stages and storage. I tested the supplied cases and the end-to-end workflow. This version does not send messages, authenticate a team or verify payments. My next step would be approved programme knowledge and authenticated team access.”

Finish with the outcome: “The team can see who this person is, what we know, and what to do next—without losing their original message.”

## Submission checklist

- Record and review your Loom; confirm length ≤5 minutes and readable text/audio.
- Include the Loom URL, source archive/repository, and the short submission note.
- Include a hosted demo URL only after verifying it from another browser/device. A localhost URL works only on the computer running the server.
- Exclude `.env`, database files, keys and local logs. The submission ZIP is prepared from an explicit allowlist.
- Read `QA.md` and `live-ai-evaluation.json` before quoting any accuracy result. The reviewed labels are our interpretations of the supplied data.
- Revoke the temporary key after you finish the live demo/testing and configure a replacement if reviewers need continued AI access.
