import { validateLead } from "./domain.js";
import { createHash, randomUUID } from "node:crypto";
import { analyze } from "./ai.js";
import { samples } from "./samples.js";

export function createAutomation(store, analyzer = analyze) {
  const running = new Set();
  const isPg = Boolean(store.isPg);

  async function process(input) {
    if (
      typeof input.message !== "string" ||
      !input.message.trim() ||
      input.message.length > 8000
    )
      throw new Error("A message of 1–8000 characters is required.");
    if (
      ![
        "WhatsApp",
        "Facebook Messenger",
        "Facebook comment",
        "Website form",
        "Phone call note",
      ].includes(input.channel)
    )
      throw new Error("Choose a valid channel.");

    const source = samples.find(
      (s) =>
        s.message === input.message &&
        s.channel === input.channel &&
        s["sender name"] === (input.name || "") &&
        s.phone === (input.phone || ""),
    );

    const clean = {
      message: input.message,
      channel: input.channel,
      name: String(input.name || ""),
      phone: String(input.phone || ""),
      ...(source
        ? {
            sourceId: source.id,
            receivedAt: source["received at"].replace(" ", "T") + ":00+06:00",
          }
        : {}),
    };

    const key = createHash("sha256")
      .update(JSON.stringify(clean))
      .digest("hex");

    const existingJobs = isPg ? await store.jobs() : store.jobs();
    let job = existingJobs.find((j) => j.key === key);
    if (job && job.status !== "Failed") return job;
    if (running.has(key))
      throw new Error("This enquiry is already processing.");

    running.add(key);
    job = job || {
      id: randomUUID(),
      key,
      input: clean,
      createdAt: new Date().toISOString(),
    };
    job.status = "Processing";
    const currentSettings = isPg ? await store.settings() : store.settings();
    job.mode = currentSettings.mode;
    job.error = "";
    if (isPg) await store.saveJob(job);
    else store.saveJob(job);

    try {
      job.result = await analyzer(clean);
      job.reasons = [];
      if (!job.result.phone) job.reasons.push("Missing phone");
      if (job.result.name === "Unknown") job.reasons.push("Unknown sender");
      if (job.result.program === "Unspecified")
        job.reasons.push("Programme not confirmed");
      if (job.result.route !== "Sales")
        job.reasons.push(job.result.route + " requires review");

      const allLeads = isPg ? await store.all() : store.all();
      if (
        allLeads.some(
          (l) =>
            l.messages.some(
              (m) => m.sourceId && m.sourceId === clean.sourceId,
            ) ||
            (job.result.phone && l.phone === job.result.phone),
        )
      )
        job.reasons.push("Existing contact: verify changes");

      if (job.mode === "manual" || job.reasons.length) {
        job.status = "Pending";
        if (isPg) await store.saveJob(job);
        else store.saveJob(job);
      } else {
        if (isPg) await commitAsync(job, job.result, false);
        else commitSync(job, job.result, false);
      }
    } catch (e) {
      job.status = "Failed";
      job.error = e.message;
      if (isPg) await store.saveJob(job);
      else store.saveJob(job);
    } finally {
      running.delete(key);
    }
    return job;
  }

  function commitSync(job, result, human) {
    validateLead({
      ...result,
      status: "New",
      owner: "",
      notes: "",
      nextFollowUp: "",
      draft: result.reply,
    });
    const saved = store.add({ ...job.input, ...result, applyReview: human });
    const lead = saved.lead;
    if (
      !saved.merged &&
      !lead.nextFollowUp &&
      !["Paid", "Lost"].includes(lead.status) &&
      ["Sales", "Support"].includes(lead.route)
    )
      lead.nextFollowUp = new Date(Date.now() + 48 * 3600000).toISOString();
    if (!lead.nextAction)
      lead.nextAction =
        lead.route === "Support"
          ? "Review support request"
          : lead.route === "Sales"
            ? "Review draft and contact enquiry"
            : "Review " + lead.route.toLowerCase() + " enquiry";
    lead.audit.push({
      at: new Date().toISOString(),
      action: human
        ? "Verified automation result"
        : "Automatically saved enquiry, draft and 48-hour follow-up",
    });
    store.write(lead);
    job.status = human ? "Approved" : "Completed";
    job.result = result;
    job.leadId = lead.id;
    job.completedAt = new Date().toISOString();
    store.saveJob(job);
    return job;
  }

  async function commitAsync(job, result, human) {
    validateLead({
      ...result,
      status: "New",
      owner: "",
      notes: "",
      nextFollowUp: "",
      draft: result.reply,
    });
    const saved = await store.add({ ...job.input, ...result, applyReview: human });
    const lead = saved.lead;
    if (
      !saved.merged &&
      !lead.nextFollowUp &&
      !["Paid", "Lost"].includes(lead.status) &&
      ["Sales", "Support"].includes(lead.route)
    )
      lead.nextFollowUp = new Date(Date.now() + 48 * 3600000).toISOString();
    if (!lead.nextAction)
      lead.nextAction =
        lead.route === "Support"
          ? "Review support request"
          : lead.route === "Sales"
            ? "Review draft and contact enquiry"
            : "Review " + lead.route.toLowerCase() + " enquiry";
    lead.audit.push({
      at: new Date().toISOString(),
      action: human
        ? "Verified automation result"
        : "Automatically saved enquiry, draft and 48-hour follow-up",
    });
    await store.write(lead);
    job.status = human ? "Approved" : "Completed";
    job.result = result;
    job.leadId = lead.id;
    job.completedAt = new Date().toISOString();
    await store.saveJob(job);
    return job;
  }

  function review(id, action, changes = {}) {
    if (isPg) {
      return (async () => {
        const existingJobs = await store.jobs();
        const job = existingJobs.find((j) => j.id === id);
        if (!job || job.status !== "Pending")
          throw new Error("Only pending enquiries can be reviewed.");
        if (action === "reject") {
          job.status = "Rejected";
          job.completedAt = new Date().toISOString();
          await store.saveJob(job);
          return job;
        }
        if (action !== "approve") throw new Error("Invalid review action.");
        const allowed = ["name", "phone", "program", "route", "language", "reply"];
        return commitAsync(
          job,
          {
            ...job.result,
            ...Object.fromEntries(
              Object.entries(changes).filter(([k]) => allowed.includes(k)),
            ),
          },
          true,
        );
      })();
    }

    const job = store.jobs().find((j) => j.id === id);
    if (!job || job.status !== "Pending")
      throw new Error("Only pending enquiries can be reviewed.");
    if (action === "reject") {
      job.status = "Rejected";
      job.completedAt = new Date().toISOString();
      store.saveJob(job);
      return job;
    }
    if (action !== "approve") throw new Error("Invalid review action.");
    const allowed = ["name", "phone", "program", "route", "language", "reply"];
    return commitSync(
      job,
      {
        ...job.result,
        ...Object.fromEntries(
          Object.entries(changes).filter(([k]) => allowed.includes(k)),
        ),
      },
      true,
    );
  }

  return { process, review };
}
