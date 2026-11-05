/**
 * Reply guardrails, enforced in code rather than trusted to the prompt.
 *
 * `checkReply` lists every way a drafted reply breaks BIAI's reply policy:
 * stating prices, dates or outcomes the team hasn't confirmed, confirming a
 * payment, claiming something was already done, the wrong language, unknown
 * links, or rambling. A reply with violations is never sent automatically.
 *
 * `autoReplyDecision` is the single gate for automatic replies. Anything
 * uncertain is held for a person; the rules are deliberately conservative.
 */

const MONTHS =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

const RULES = [
  {
    id: "price",
    label: "States a price or amount",
    test: /৳|\b(?:tk|bdt|usd)\.?\s*\d|\d[\d,.]*\s*(?:k\s*)?(?:tk|taka|bdt|usd|টাকা)\b|\$\s*\d|\d[\d,]*\s*টাকা/i,
  },
  {
    id: "date",
    label: "States a specific date",
    test: new RegExp(
      `\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTHS})\\b|\\b(?:${MONTHS})\\s+\\d{1,2}(?:st|nd|rd|th)?\\b|\\b\\d{1,2}[/-]\\d{1,2}(?:[/-]\\d{2,4})?\\b`,
      "i",
    ),
  },
  {
    id: "guarantee",
    label: "Promises an outcome (job, approval or refund)",
    test: /guarantee|\b100\s*%|assured (?:job|placement)|নিশ্চিত (?:চাকরি|জব)|job (?:nishchit|confirm)|full refund|will (?:be )?refund|refund (?:korbo|kore debo|দেওয়া হবে)|ফেরত দেওয়া হবে|(?:you are|you're) (?:approved|accepted|eligible)/i,
  },
  {
    id: "payment",
    label: "Confirms a payment",
    test: /(?:payment|bkash|nagad|পেমেন্ট|টাকা)[^.!?।\n]{0,40}(?:has been|is|was|have been)\s+(?:received|confirmed|verified)|(?:received|confirmed|verified) (?:your|the) payment|পেমেন্ট (?:পেয়েছি|কনফার্ম(?:ড)? হয়েছে)|payment (?:peyechi|confirm hoyeche)/i,
  },
  {
    id: "claim",
    label: "Claims an action was already taken",
    test: /\b(?:we(?:'ve| have)|i(?:'ve| have)) (?:already )?(?:sent|escalated|forwarded|booked|scheduled|enrolled|registered)\b|has been (?:escalated|forwarded|booked|scheduled)/i,
  },
];

const ALLOWED_DOMAIN = /(^|\.)biai\.com\.bd$/i;
const MAX_WORDS = 90;

/** Every policy violation in `reply` (empty when the reply is safe). */
export function checkReply(reply, { language, route } = {}) {
  const text = String(reply || "").trim();
  if (route === "Spam") return text ? [{ id: "spam", label: "Spam must not get a reply" }] : [];
  if (!text) return [{ id: "empty", label: "No reply was drafted" }];

  const violations = RULES.filter((rule) => rule.test.test(text)).map(({ id, label }) => ({ id, label }));

  // Bangla letters, signs and digits; excludes the currency/fraction signs (৲ ৳ …).
  const hasBangla = /[ঀ-ৱ]/.test(text);
  if (language === "Bangla" && !hasBangla) violations.push({ id: "language", label: "Should be in Bangla script" });
  if ((language === "English" || language === "Banglish") && hasBangla)
    violations.push({ id: "language", label: `Should be in ${language}, not Bangla script` });

  const hosts = [...text.matchAll(/\b(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?:\/\S*)?/gi)]
    .map((m) => m[1].toLowerCase())
    .filter((host) => /\.(?:com|net|org|io|ly|me|bd|info|xyz|co)$/.test(host));
  const emails = [...text.matchAll(/[\w.+-]+@([\w-]+(?:\.[\w-]+)+)/g)].map((m) => m[1].toLowerCase());
  if ([...hosts, ...emails].some((host) => !ALLOWED_DOMAIN.test(host)))
    violations.push({ id: "link", label: "Contains a link or address outside biai.com.bd" });

  if (text.split(/\s+/).length > MAX_WORDS) violations.push({ id: "length", label: `Longer than ${MAX_WORDS} words` });
  return violations;
}

export const AUTO_REPLY_MODES = ["off", "safe"];
const MAX_CONSECUTIVE_AUTO = 2;

/**
 * Should this reply go out automatically? Returns { send, reason }.
 * Only a confident, policy-clean, live (or reviewed-sample) reply to a sales
 * enquiry from an unassigned, non-urgent contact is sent. After two automatic
 * replies in a row, a person takes over.
 */
export function autoReplyDecision({ setting, analysis, lead }) {
  const hold = (reason) => ({ send: false, reason });
  if (setting !== "safe") return hold("Auto-reply is off.");
  if (!analysis?.reply?.trim()) return hold("No reply was drafted.");
  if (analysis.route !== "Sales" || lead.route !== "Sales") return hold(`${lead.route === "Sales" ? analysis.route : lead.route} enquiries are answered by a person.`);
  if (!["live", "sample"].includes(analysis.mode)) return hold("Rule-based draft (live AI unavailable), so a person reviews it.");
  if (analysis.confidence !== "high") return hold(`AI confidence is ${analysis.confidence || "unknown"}.`);
  if (analysis.urgent || lead.priority === "Urgent") return hold("Marked urgent.");
  if (analysis.policy?.length) return hold(`Reply policy: ${analysis.policy.map((v) => v.label.toLowerCase()).join("; ")}.`);
  if (lead.owner) return hold(`Assigned to ${lead.owner}, who replies personally.`);
  if (["Paid", "Lost"].includes(lead.status)) return hold(`Contact is ${lead.status}.`);

  const outbound = lead.messages.filter((m) => m.direction === "outbound");
  const recentAuto = [];
  for (const message of [...outbound].reverse()) {
    if (message.delivery !== "auto") break;
    recentAuto.push(message);
  }
  if (recentAuto.length >= MAX_CONSECUTIVE_AUTO) return hold(`Already sent ${MAX_CONSECUTIVE_AUTO} automatic replies; a person takes over.`);
  return { send: true, reason: "Confident, policy-checked sales reply." };
}
