import type { Lead, Queue, Stage } from "@/types";
import { formatDayMonth } from "./format";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
export const FOLLOW_UP_HOURS = 48;

export type Tone = "neutral" | "brand" | "info" | "violet" | "warning" | "success" | "danger";

export const STAGE_TONE: Record<Stage, Tone> = {
  New: "info",
  Contacted: "violet",
  Interested: "warning",
  Paid: "success",
  Lost: "neutral",
};

export const QUEUE_TONE: Record<Queue, Tone> = {
  Sales: "brand",
  Support: "danger",
  Careers: "violet",
  Spam: "neutral",
};

/** Whether the contact is part of the follow-up queue at all. */
export function needsFollowUp(lead: Lead) {
  if (lead.route === "Support" && lead.supportStatus === "Resolved") return false;
  if (lead.status === "Paid" || lead.status === "Lost") return false;
  return lead.route === "Sales" || lead.route === "Support";
}

/** When the next follow-up is due: the scheduled date, or 48 hours after the last touchpoint. */
export function dueAt(lead: Lead) {
  if (lead.nextFollowUp) return Date.parse(lead.nextFollowUp);
  return Date.parse(lead.lastContactAt || lead.receivedAt) + FOLLOW_UP_HOURS * HOUR;
}

export interface FollowUpState {
  kind: "none" | "scheduled" | "due-soon" | "overdue";
  tone: Tone;
  label: string;
  overdueDays: number;
}

/**
 * Severity-graded follow-up status so the queue isn't a wall of red:
 * due within a day is a warning, over three days overdue is danger.
 */
export function followUpState(lead: Lead, now = Date.now()): FollowUpState {
  if (!needsFollowUp(lead)) return { kind: "none", tone: "neutral", label: "No follow-up", overdueDays: 0 };
  const due = dueAt(lead);
  const diff = now - due;
  if (diff >= 0) {
    const days = Math.floor(diff / DAY);
    if (days === 0) return { kind: "overdue", tone: "warning", label: "Due today", overdueDays: 0 };
    return {
      kind: "overdue",
      tone: days >= 3 ? "danger" : "warning",
      label: `${days} day${days === 1 ? "" : "s"} overdue`,
      overdueDays: days,
    };
  }
  if (-diff < DAY) return { kind: "due-soon", tone: "info", label: "Due within 24 h", overdueDays: 0 };
  return { kind: "scheduled", tone: "neutral", label: `Due ${formatDayMonth(new Date(due).toISOString())}`, overdueDays: 0 };
}

export const isOverdue = (lead: Lead, now = Date.now()) => followUpState(lead, now).kind === "overdue";

/** "Mahmud Hasan (Managing Director, Gazipur…)" → name + detail on a second line. */
export function splitName(name: string) {
  const match = name.match(/^(.*?)\s*\((.+)\)\s*$/);
  return match ? { primary: match[1], secondary: match[2] } : { primary: name, secondary: "" };
}

export function initials(name: string) {
  const parts = splitName(name).primary.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Bangladesh mobile → wa.me link with a pre-filled message. */
export function whatsappUrl(phone: string, text = "") {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  const international = digits.startsWith("880") ? digits : `880${digits.replace(/^0/, "")}`;
  return `https://wa.me/${international}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** Messages the customer sent (excludes BIAI's replies). */
export const inboundMessages = (lead: Lead) => lead.messages.filter((m) => m.direction !== "outbound");

/** The customer's latest message. */
export const lastMessage = (lead: Lead) => inboundMessages(lead).at(-1);

export function flags(lead: Lead) {
  const result: string[] = [];
  if (!lead.phone) result.push("Missing phone");
  if (lead.program === "Unspecified" && lead.route === "Sales") result.push("Programme unclear");
  if (lead.route === "Support") result.push("Human review");
  return result;
}

export const DRAFT_LABEL: Record<string, string> = {
  live: "Live AI draft",
  sample: "Reviewed sample",
  heuristic: "Rule-based draft",
  "human-reviewed": "Edited by team",
  manual: "Manual",
};

export function matchesQuery(lead: Lead, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [lead.name, lead.phone, lead.notes, lead.owner, lead.nextAction, ...lead.messages.map((m) => m.text)]
    .join(" ")
    .toLowerCase()
    .includes(q);
}
