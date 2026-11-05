import { createHash } from "node:crypto";
import { FOLLOW_UP_HOURS, normalizePhone, validateLead } from "../../domain/lead.js";
import { withTransaction } from "../../db/pool.js";
import { badRequest } from "../../utils/http-error.js";
import * as leadsRepo from "../leads/leads.repository.js";
import * as repo from "./automation.repository.js";

const REVIEWABLE_FIELDS = ["name", "phone", "program", "route", "language", "reply"];

function defaultNextAction(route) {
  if (route === "Support") return "Review support request";
  if (route === "Sales") return "Review draft and contact enquiry";
  return `Review ${route.toLowerCase()} enquiry`;
}

/**
 * Automated intake: extract, classify and draft each submitted enquiry.
 * In automatic mode, complete new sales enquiries are saved with a 48-hour
 * follow-up; anything incomplete, non-sales or matching an existing contact
 * waits for a person. Nothing is ever sent.
 */
export function createAutomationService({ pool, ai, leadsService, samples }) {
  const settings = () => repo.getSettings(pool);

  async function saveSettings({ mode }) {
    return repo.saveSettings(pool, { mode });
  }

  const listJobs = () => repo.list(pool);

  async function reasonsFor(result, input) {
    const reasons = [];
    if (!result.phone) reasons.push("Missing phone");
    if (!result.name || result.name === "Unknown") reasons.push("Unknown sender");
    if (result.program === "Unspecified") reasons.push("Programme not confirmed");
    if (result.route !== "Sales") reasons.push(`${result.route} enquiry needs review`);
    const existing =
      (await leadsRepo.findIdBySourceId(pool, input.sourceId)) ||
      (await leadsRepo.findIdByPhone(pool, normalizePhone(result.phone || "")));
    if (existing) reasons.push("Matches an existing contact");
    if (result.mode === "heuristic") reasons.push("Rule-based extraction (no live AI): check every field");
    return reasons;
  }

  async function commit(job, result, { reviewer } = {}) {
    validateLead({ ...result, status: "New", owner: "", notes: "", nextFollowUp: "" });
    const author = reviewer ? reviewer.name : "Automation";
    const saved = await leadsService.ingest(
      { ...job.input, ...result, applyReview: Boolean(reviewer) },
      author,
    );
    const lead = saved.lead;
    const changes = {};
    if (saved.created && !lead.nextFollowUp && ["Sales", "Support"].includes(lead.route))
      changes.nextFollowUp = new Date(Date.now() + FOLLOW_UP_HOURS * 3600000).toISOString();
    if (!lead.nextAction) changes.nextAction = defaultNextAction(lead.route);
    await withTransaction(pool, async (db) => {
      await leadsRepo.updateLead(db, lead.id, changes);
      await leadsRepo.addActivity(
        db,
        lead.id,
        reviewer ? "Approved automation result" : "Saved automatically with a 48-hour follow-up",
        author,
      );
    });
    return repo.update(pool, job.id, {
      status: reviewer ? "Approved" : "Completed",
      result,
      leadId: lead.id,
      completed: true,
    });
  }

  async function process(raw) {
    const source = samples.find(
      (s) =>
        s.message === raw.message &&
        s.channel === raw.channel &&
        s["sender name"] === raw.name &&
        s.phone === raw.phone,
    );
    const input = {
      message: raw.message,
      channel: raw.channel,
      name: raw.name,
      phone: raw.phone,
      ...(source
        ? { sourceId: source.id, receivedAt: source["received at"].replace(" ", "T") + ":00+06:00" }
        : {}),
    };
    const key = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    const { mode } = await settings();

    const job = await repo.upsertProcessing(pool, { key, mode, input });
    if (!job) return repo.findByKey(pool, key); // already processed (or processing): reuse it

    try {
      const result = await ai.analyze({ ...input, allowHeuristic: true });
      const reasons = await reasonsFor(result, input);
      if (mode === "manual" || reasons.length)
        return repo.update(pool, job.id, { status: "Pending", result, reasons });
      return await commit({ ...job, input }, result);
    } catch (error) {
      return repo.update(pool, job.id, { status: "Failed", error: error.message });
    }
  }

  async function review(id, action, changes = {}, reviewer) {
    const job = await repo.findById(pool, id);
    if (!job || job.status !== "Pending") throw badRequest("Only enquiries waiting for review can be approved or rejected.");
    if (action === "reject") return repo.update(pool, id, { status: "Rejected", completed: true });
    const edited = Object.fromEntries(
      Object.entries(changes).filter(([key]) => REVIEWABLE_FIELDS.includes(key)),
    );
    return commit(job, { ...job.result, ...edited }, { reviewer });
  }

  return {
    settings,
    saveSettings,
    listJobs,
    process,
    review,
    recover: () => repo.failInterrupted(pool),
  };
}
