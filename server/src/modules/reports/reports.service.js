import { PROGRAMS, overdue } from "../../domain/lead.js";
import * as leadsRepo from "../leads/leads.repository.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Weekly brief: deterministic totals for the seven Dhaka days ending on
 * `end`, plus three action priorities (live AI or rules).
 */
export function createReportsService({ pool, ai }) {
  async function weekly(end) {
    const periodEnd = new Date(`${end}T23:59:59.999+06:00`);
    const periodStart = new Date(periodEnd.getTime() - 7 * DAY_MS + 1);
    // Enquiry totals count what customers sent, not BIAI's replies.
    const inPeriod = (m) => {
      if (m.direction === "outbound") return false;
      const t = Date.parse(m.receivedAt);
      return t >= periodStart.getTime() && t <= periodEnd.getTime();
    };

    const all = await leadsRepo.findAll(pool);
    const period = all.filter((l) => l.messages.some(inPeriod));
    const programmes = Object.fromEntries(PROGRAMS.map((p) => [p, 0]));
    for (const lead of period) if (lead.route === "Sales") programmes[lead.program] += 1;

    const totals = {
      messages: period.reduce((n, l) => n + l.messages.filter(inPeriod).length, 0),
      contacts: period.length,
      sales: period.filter((l) => l.route === "Sales").length,
      support: period.filter((l) => l.route === "Support").length,
      careers: period.filter((l) => l.route === "Careers").length,
      spam: period.filter((l) => l.route === "Spam").length,
      overdueNow: all.filter((l) => overdue(l)).length,
    };

    const summary = await ai.summarize(
      {
        period: `Seven days ending ${end} (Asia/Dhaka)`,
        count: totals.messages,
        leadCount: totals.contacts,
        sales: totals.sales,
        support: totals.support,
        overdue: totals.overdueNow,
        notes: period.map((l) => ({ name: l.name, route: l.route, program: l.program, notes: l.notes })),
      },
      undefined,
      { allowHeuristic: true },
    );

    return {
      period: { start: periodStart.toISOString(), end: periodEnd.toISOString(), endDate: end },
      totals,
      programmes,
      supportCases: period
        .filter((l) => l.route === "Support")
        .map((l) => ({ id: l.id, name: l.name, status: l.supportStatus, priority: l.priority })),
      priorities: summary.priorities,
      mode: summary.mode,
      notice: summary.notice,
      generatedAt: new Date().toISOString(),
    };
  }

  return { weekly };
}
