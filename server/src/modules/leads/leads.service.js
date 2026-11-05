import { withTransaction } from "../../db/pool.js";
import { normalizePhone, validateLead } from "../../domain/lead.js";
import { badRequest, conflict, notFound } from "../../utils/http-error.js";
import * as repo from "./leads.repository.js";

/** Fields a team member may edit on an existing contact. */
export const EDITABLE_FIELDS = [
  "name",
  "phone",
  "program",
  "route",
  "language",
  "status",
  "supportStatus",
  "priority",
  "owner",
  "notes",
  "nextAction",
  "nextFollowUp",
  "draft",
];

const FIELD_LABELS = {
  name: "name",
  phone: "phone",
  program: "programme",
  route: "queue",
  language: "language",
  notes: "team notes",
  nextAction: "next action",
  nextFollowUp: "follow-up date",
  draft: "reply draft",
};

/** Merged fields that change silently (no activity entry of their own). */
const SILENT_MERGE = new Set(["draft", "draftMode", "analysisReason", "language", "nextAction"]);

/**
 * Apply an automatic analysis of a follow-up message to an existing contact
 * without losing what is already known: a programme or name is only filled
 * in, never reset to "Unspecified"/"Unknown"; a contact is only ever escalated
 * to Support (never moved out of it); urgency only goes up. Owner, stage and
 * notes are never touched.
 */
export function mergeAnalysis(existing, input) {
  const known = (v) => v && v !== "Unknown" && v !== "Unspecified";
  const changes = {
    draft: input.reply || "",
    draftMode: input.mode || "manual",
    analysisReason: input.reason || "",
  };
  if (input.language && input.language !== existing.language) changes.language = input.language;
  if (known(input.program) && input.program !== existing.program) changes.program = input.program;
  if (!known(existing.name) && known(input.name)) changes.name = input.name;
  const phone = normalizePhone(input.phone || "");
  if (!existing.phone && phone) changes.phone = phone;
  if (input.route === "Support" && existing.route !== "Support") {
    changes.route = "Support";
    changes.supportStatus = "Open";
  }
  if (input.priority === "Urgent" && existing.priority !== "Urgent") changes.priority = "Urgent";
  if (input.nextAction && !existing.nextAction) changes.nextAction = input.nextAction.slice(0, 500);
  return changes;
}

/** Turn a set of changes into readable activity entries. */
function describeChanges(before, after, keys) {
  const entries = [];
  const rest = [];
  for (const key of keys) {
    if (before[key] === after[key]) continue;
    if (key === "status") entries.push(`Moved stage from ${before.status} to ${after.status}`);
    else if (key === "owner") entries.push(after.owner ? `Assigned to ${after.owner}` : "Removed owner");
    else if (key === "priority") entries.push(`Marked priority ${after.priority}`);
    else if (key === "supportStatus") entries.push(`Marked support case ${after.supportStatus}`);
    else rest.push(FIELD_LABELS[key] || key);
  }
  if (rest.length) entries.push(`Updated ${rest.join(", ")}`);
  return entries;
}

export function createLeadsService({ pool, ai }) {
  async function list() {
    return repo.findAll(pool);
  }

  async function get(id) {
    const lead = await repo.findById(pool, id);
    if (!lead) throw notFound("Contact not found.");
    return lead;
  }

  /**
   * Save an enquiry. A matching source message or phone number joins the
   * existing contact instead of creating a duplicate; blank phones never merge.
   * With `applyReview`, the reviewed intake fields and reply are applied to
   * the existing contact while owner, stage and notes are preserved.
   */
  async function ingest(input, author = "System") {
    const receivedAt = input.receivedAt || new Date().toISOString();
    const phone = normalizePhone(input.phone || "");

    return withTransaction(pool, async (db) => {
      const existingId =
        (await repo.findIdBySourceId(db, input.sourceId)) || (await repo.findIdByPhone(db, phone));

      if (existingId) {
        const existing = await repo.findById(db, existingId);
        const duplicate = await repo.hasMessage(db, existingId, {
          sourceId: input.sourceId,
          text: input.message,
          channel: input.channel,
          receivedAt,
        });
        const changes = {};

        if (input.applyReview) {
          if (phone && (await repo.findIdByPhone(db, phone, { excludeId: existingId })))
            throw conflict("That phone belongs to a different contact. Review the identity before saving.");
          Object.assign(changes, {
            name: input.name || existing.name,
            phone,
            program: input.program,
            route: input.route,
            language: input.language,
            draft: input.reply || "",
            draftMode: input.mode || "manual",
            analysisReason: input.reason || "",
          });
          validateLead({ ...existing, ...changes });
          await repo.addActivity(db, existingId, "Saved reviewed intake details and reply", author);
        } else if (input.mergeAnalysis && !duplicate) {
          const merged = mergeAnalysis(existing, input);
          if (merged.phone && (await repo.findIdByPhone(db, merged.phone, { excludeId: existingId }))) delete merged.phone;
          Object.assign(changes, merged);
          validateLead({ ...existing, ...changes });
          const learned = describeChanges(existing, { ...existing, ...changes }, Object.keys(merged).filter((k) => !SILENT_MERGE.has(k)));
          for (const entry of learned) await repo.addActivity(db, existingId, `${entry} from the new message`, author);
        }

        if (!duplicate) {
          await repo.insertMessage(db, existingId, {
            text: input.message,
            channel: input.channel,
            receivedAt,
            sourceId: input.sourceId,
            sender: input.name || existing.name,
            phone,
          });
          if (existing.route === "Support") changes.supportStatus = "Open";
          if (Date.parse(receivedAt) > Date.parse(existing.receivedAt)) changes.receivedAt = receivedAt;
          await repo.addActivity(db, existingId, `New message via ${input.channel}`, author);
        }

        await repo.updateLead(db, existingId, changes);
        return { lead: await repo.findById(db, existingId), created: false, duplicate };
      }

      const valid = validateLead({
        name: input.name || "Unknown",
        phone,
        program: input.program || "Unspecified",
        route: input.route || "Sales",
        language: input.language || "English",
        status: "New",
        owner: "",
        notes: "",
        nextFollowUp: "",
      });
      const id = await repo.insertLead(db, {
        ...valid,
        nextAction: typeof input.nextAction === "string" ? input.nextAction.slice(0, 500) : undefined,
        priority: input.priority === "Urgent" ? "Urgent" : "Normal",
        receivedAt,
        draft: input.reply || "",
        draftMode: input.mode || "manual",
        analysisReason: input.reason || "",
      });
      await repo.insertMessage(db, id, {
        text: input.message,
        channel: input.channel,
        receivedAt,
        sourceId: input.sourceId,
        sender: valid.name,
        phone: valid.phone,
      });
      const origin = { live: "live AI", sample: "reviewed sample", heuristic: "rule-based" }[input.mode] || "manual";
      await repo.addActivity(db, id, `Created from ${input.channel} enquiry (${origin} intake)`, author);
      return { lead: await repo.findById(db, id), created: true, duplicate: false };
    });
  }

  async function update(id, input, user) {
    const lead = await get(id);
    const changes = Object.fromEntries(
      Object.entries(input).filter(([key]) => EDITABLE_FIELDS.includes(key)),
    );
    if (!Object.keys(changes).length) throw badRequest("Nothing to update.");

    const next = validateLead({ ...lead, ...changes });
    if (next.phone && (await repo.findIdByPhone(pool, next.phone, { excludeId: id })))
      throw conflict("This phone belongs to another contact. Open that contact instead.");
    if (changes.draft !== undefined && changes.draft !== lead.draft) next.draftMode = "human-reviewed";

    const entries = describeChanges(lead, next, Object.keys(changes));
    await withTransaction(pool, async (db) => {
      const fields = Object.fromEntries(
        [...Object.keys(changes), "draftMode"].map((key) => [key, next[key]]),
      );
      await repo.updateLead(db, id, fields);
      for (const entry of entries) await repo.addActivity(db, id, entry, user.name);
    });
    return get(id);
  }

  /** Record an outreach the team member already completed (nothing is sent). */
  async function logContact(id, user) {
    const lead = await get(id);
    const now = new Date();
    const changes = { lastContactAt: now.toISOString() };
    if (lead.nextFollowUp && Date.parse(lead.nextFollowUp) <= now.getTime()) changes.nextFollowUp = "";
    if (lead.status === "New") changes.status = "Contacted";
    await withTransaction(pool, async (db) => {
      await repo.updateLead(db, id, changes);
      await repo.addActivity(
        db,
        id,
        changes.status ? "Logged completed contact and moved to Contacted" : "Logged completed contact",
        user.name,
      );
    });
    return get(id);
  }

  async function generateDraft(id, user) {
    const lead = await get(id);
    if (lead.route === "Spam") throw badRequest("Spam is quarantined. No reply is drafted.");
    const result = await ai.draftReply(lead, undefined, { allowHeuristic: true });
    await withTransaction(pool, async (db) => {
      await repo.updateLead(db, id, { draft: result.reply, draftMode: result.mode });
      const label = { live: "live AI", sample: "reviewed sample", heuristic: "rule-based" }[result.mode] || result.mode;
      const check = result.policy?.length ? `; check: ${result.policy.map((v) => v.label.toLowerCase()).join(", ")}` : "";
      await repo.addActivity(db, id, `Drafted a new reply (${label}${check})`, user.name);
    });
    return get(id);
  }

  /** The contact a phone number belongs to, if any (for conversation context). */
  async function findByPhone(phone) {
    const id = await repo.findIdByPhone(pool, normalizePhone(phone || ""));
    return id ? repo.findById(pool, id) : null;
  }

  /**
   * Record a reply that BIAI sent (automatically, or by a team member outside
   * the CRM) as an outbound message. Counts as a completed contact: New moves
   * to Contacted, a passed follow-up date is cleared, and a sent draft is
   * cleared so nobody sends it twice.
   */
  async function recordReply(id, { text, channel, author, delivery = "manual" }) {
    const lead = await get(id);
    const body = String(text || "").trim();
    if (!body) throw badRequest("Write the reply that was sent.");
    if (lead.route === "Spam") throw badRequest("Spam is quarantined. Replies are not recorded.");
    const now = new Date();
    const lastInbound = lead.messages.filter((m) => m.direction !== "outbound").at(-1);
    const via = channel || lastInbound?.channel || "WhatsApp";
    const changes = { lastContactAt: now.toISOString() };
    if (lead.status === "New") changes.status = "Contacted";
    if (lead.nextFollowUp && Date.parse(lead.nextFollowUp) <= now.getTime()) changes.nextFollowUp = "";
    if (lead.draft && lead.draft.trim() === body) changes.draft = "";
    await withTransaction(pool, async (db) => {
      await repo.insertMessage(db, id, {
        text: body,
        channel: via,
        receivedAt: now.toISOString(),
        sender: "BIAI Admissions",
        direction: "outbound",
        author,
        delivery,
      });
      await repo.updateLead(db, id, changes);
      const how = delivery === "auto" ? "Sent an automatic reply" : "Logged a reply sent";
      await repo.addActivity(db, id, `${how} via ${via}${changes.status ? " and moved to Contacted" : ""}`, author);
    });
    return get(id);
  }

  async function noteActivity(id, action, author) {
    await repo.addActivity(pool, id, action, author);
  }

  async function remove(id) {
    if (!(await repo.deleteLead(pool, id))) throw notFound("Contact not found.");
  }

  return { list, get, ingest, update, logContact, generateDraft, findByPhone, recordReply, noteActivity, remove };
}
