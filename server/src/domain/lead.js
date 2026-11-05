/** Raised when lead data breaks a business rule; safe to show to users. */
export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

export const STAGES = ["New", "Contacted", "Interested", "Paid", "Lost"];
export const ROUTES = ["Sales", "Support", "Careers", "Spam"];
export const PROGRAMS = [
  "Bootcamp",
  "Fellowship",
  "Corporate training",
  "Unspecified",
];
export const LANGUAGES = ["English", "Bangla", "Banglish"];
export const CHANNELS = [
  "WhatsApp",
  "Facebook Messenger",
  "Facebook comment",
  "Website form",
  "Phone call note",
];
export const ROLES = ["Admin", "Admissions", "Support", "Sales"];
export const FOLLOW_UP_HOURS = 48;
export function normalizePhone(value = "") {
  const digits = value
    .replace(/[০-৯]/g, (c) => String("০১২৩৪৫৬৭৮৯".indexOf(c)))
    .replace(/\D/g, "");
  return digits.startsWith("880") ? "0" + digits.slice(3) : digits;
}
export function validPhone(value) {
  return !value || /^01[3-9]\d{8}$/.test(normalizePhone(value));
}
export function overdue(lead, now = Date.now()) {
  if (lead.route === "Support" && lead.supportStatus === "Resolved")
    return false;
  if (
    ["Paid", "Lost"].includes(lead.status) ||
    ["Spam", "Careers"].includes(lead.route)
  )
    return false;
  if (lead.nextFollowUp) return Date.parse(lead.nextFollowUp) < now;
  return (
    now - Date.parse(lead.lastContactAt || lead.receivedAt) >= FOLLOW_UP_HOURS * 3600000
  );
}
export function flags(lead) {
  return [
    ...(!lead.phone ? ["Missing phone"] : []),
    ...(lead.program === "Unspecified" && lead.route === "Sales"
      ? ["Clarify programme"]
      : []),
    ...(lead.route === "Support" ? ["Human review"] : []),
  ];
}
export function validateLead(lead) {
  if (lead.supportStatus && !["Open", "Resolved"].includes(lead.supportStatus))
    throw new ValidationError("Invalid support status.");
  if (lead.priority && !["Normal", "Urgent"].includes(lead.priority))
    throw new ValidationError("Invalid priority.");
  for (const field of ["draft", "nextAction"])
    if (
      lead[field] !== undefined &&
      (typeof lead[field] !== "string" || lead[field].length > 10000)
    )
      throw new ValidationError("Invalid " + field);
  if (
    typeof lead.name !== "string" ||
    !lead.name.trim() ||
    lead.name.length > 200
  )
    throw new ValidationError("A name of 1–200 characters is required.");
  if (
    !STAGES.includes(lead.status) ||
    !ROUTES.includes(lead.route) ||
    !PROGRAMS.includes(lead.program) ||
    !LANGUAGES.includes(lead.language)
  )
    throw new ValidationError("Invalid stage, route, programme or language.");
  if (typeof lead.phone !== "string" || !validPhone(lead.phone))
    throw new ValidationError(
      "Use a valid Bangladesh mobile number or leave phone empty.",
    );
  for (const field of ["owner", "notes"])
    if (typeof lead[field] !== "string" || lead[field].length > 10000)
      throw new ValidationError("Invalid " + field);
  if (lead.nextFollowUp && !Number.isFinite(Date.parse(lead.nextFollowUp)))
    throw new ValidationError("Invalid follow-up date.");
  return { ...lead, name: lead.name.trim(), phone: normalizePhone(lead.phone) };
}
export function stats(leads, now = Date.now()) {
  return {
    total: leads.length,
    sales: leads.filter((l) => l.route === "Sales").length,
    overdue: leads.filter((l) => overdue(l, now)).length,
    support: leads.filter((l) => l.route === "Support").length,
    messages: leads.reduce((n, l) => n + l.messages.length, 0),
  };
}
