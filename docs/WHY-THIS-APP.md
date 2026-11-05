# The case for this BIAI CRM

## Positioning you can defend

“This prototype is designed around the exact decisions BIAI admissions faces: understand a multilingual message, keep its context, avoid making promises we cannot verify, and make the next human action obvious.”

Do not claim to beat every CRM or every applicant. We have not evaluated competitors or seen other submissions. Demonstrate the following advantages in the supplied cases instead.

| Evidence | What to demonstrate | Why it matters to BIAI |
|---|---|---|
| Bangla, Banglish and English | Tahmina, Rafi and Mahmud: live extraction and matched replies | Staff can work in the language the person used |
| Unknown information stays unknown | Sabbir's programme is unspecified; Tahmina's phone remains blank | Avoids confident but incorrect customer records |
| Payment claim is not payment verification | Farzana goes to Support, never automatically Paid | Avoids misleading enrolment status |
| Context survives repeat messages | Rafi has one contact with both original messages | Staff see that the person has already asked again |
| The human review is durable | Correct extracted fields and reply, save, reload | Review is a real control rather than a decorative screen |
| Support has its own completion state | Resolve a support case without marking it Paid or Lost | The follow-up queue reflects real work remaining |
| Follow-ups describe an action | Owner, urgency, next action, scheduled date and overdue age | The team can decide who should do what next |
| No simulated live intelligence | Clear sample/live labels; real Meta outputs and evaluation report | The reviewer can inspect what AI actually did |
| Calculated counts, AI priorities | Weekly counts remain deterministic; AI drafts actions | Reliable totals with useful language assistance |

## Likely objections and honest answers

**“Couldn't we use a spreadsheet?”**
A spreadsheet can hold the records. This prototype combines language interpretation, review, conversation history and a next-action queue in one flow. Show a complete example to make that benefit concrete; do not claim measured time savings without a timed comparison.

**“Why not buy an established CRM?”**
An established CRM may be the right production choice. This task demonstrates that I can understand BIAI's workflow and implement a focused AI-assisted solution. The same intake and review approach could later integrate with the team's chosen CRM.

**“Isn't this just an AI wrapper?”**
AI handles interpretation and reply drafting. Application code handles persistence, identity matching, source preservation, reminder rules and summary arithmetic. Human review controls what becomes part of the record. Demonstrate those boundaries rather than debating labels.

**“Are your results really 100% accurate?”**
No universal accuracy claim. The original 20 supplied examples matched our reviewed extraction labels in one regression run. They informed development; they are not held-out data. Names/phones were provided as channel metadata. Reply quality and future inputs still need human review. Report additional tests separately.

**“What would you do next?”**
Pilot the workflow with BIAI's team using fictional data, measure where review takes time, and add only approved programme/policy knowledge. Team sign-in and roles are in place; before real shared use, add hosting controls and per-person passwords. Channel integration and payment reconciliation require their own requirements and authorization.

## Five-minute demonstration order

1. Explain the lost-enquiry problem. Restore the sample data from the account menu so the demo starts clean.
2. Use Tahmina's supplied message: show the actual model result, missing phone, language and reply. Save and reload to prove persistence.
3. Use Rafi's two supplied messages: one contact, two originals; change the reviewed reply and save it.
4. Show Farzana and Habibur: support routing, urgency, next action and resolution without a sales conversion.
5. Show a scheduled follow-up and the weekly brief. Explain one deliberate limitation and one next improvement.

Spend more time showing the system working than describing its stack. Use your own words and be ready to explain a small code change live.
