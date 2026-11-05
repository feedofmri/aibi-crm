import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { BellRing, Copy, Headset, Inbox, ListChecks, RefreshCw, ShoppingBag, Users } from "lucide-react";
import { reportsApi } from "@/api/endpoints";
import { Badge, Button, Card, CardHeader, EmptyState, Input, PageLoader, StatCard, useToast } from "@/components/ui";
import { PageHeader } from "@/components/layout/PageHeader";
import { useContactSheet } from "@/hooks/useContactSheet";
import { queryKeys } from "@/hooks/queries";
import { formatDate, formatDateTime } from "@/lib/format";
import type { Programme, WeeklyReport } from "@/types";
import styles from "./WeeklyBriefPage.module.css";

/** The supplied enquiries all fall in the week ending 1 Nov 2026. */
const DEFAULT_END = "2026-11-01";

function reportAsText(report: WeeklyReport) {
  const t = report.totals;
  return [
    `BIAI admissions weekly brief: ${formatDate(report.period.start)} to ${formatDate(report.period.end)}`,
    "",
    `${t.messages} enquiries from ${t.contacts} contacts (${t.sales} sales, ${t.support} support, ${t.careers} careers, ${t.spam} spam).`,
    `${t.overdueNow} contacts need follow-up today.`,
    "",
    "Sales interest by programme:",
    ...Object.entries(report.programmes).map(([p, n]) => `- ${p === "Unspecified" ? "Programme to confirm" : p}: ${n}`),
    "",
    `Priorities (${report.mode === "live" ? "live AI" : "rule-based"}):`,
    ...report.priorities.map((p, i) => `${i + 1}. ${p}`),
  ].join("\n");
}

export function WeeklyBriefPage() {
  const toast = useToast();
  const { open } = useContactSheet();
  const [draftEnd, setDraftEnd] = useState(DEFAULT_END);
  const [end, setEnd] = useState(DEFAULT_END);

  const report = useQuery({
    queryKey: queryKeys.weekly(end),
    queryFn: () => reportsApi.weekly(end),
    staleTime: 5 * 60_000,
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (draftEnd === end) void report.refetch();
    else setEnd(draftEnd);
  }

  async function copy() {
    if (!report.data) return;
    try {
      await navigator.clipboard.writeText(reportAsText(report.data));
      toast.success("Brief copied. Paste it into email or chat.");
    } catch {
      toast.error("Couldn't copy the brief.");
    }
  }

  const data = report.data;
  const maxProgramme = data ? Math.max(1, ...Object.values(data.programmes)) : 1;

  return (
    <>
      <PageHeader
        title="Weekly brief"
        description="Enquiries received in a seven-day window, what's outstanding today, and three priorities for the team."
        actions={
          <Button icon={<Copy />} onClick={copy} disabled={!data}>
            Copy brief
          </Button>
        }
      />

      <form className={styles.toolbar} onSubmit={submit}>
        <label className={styles.dateField}>
          <span>Week ending</span>
          <Input type="date" value={draftEnd} max="2100-12-31" onChange={(e) => setDraftEnd(e.target.value)} required />
        </label>
        <Button type="submit" icon={<RefreshCw />} loading={report.isFetching}>
          Update
        </Button>
        {data && (
          <p className={styles.period}>
            {formatDate(data.period.start)} – {formatDate(data.period.end)} · Asia/Dhaka
          </p>
        )}
      </form>

      {report.isPending ? (
        <PageLoader label="Building the brief" />
      ) : report.isError ? (
        <EmptyState title="Couldn't build the brief" description={report.error.message} action={<Button onClick={() => report.refetch()}>Try again</Button>} />
      ) : data ? (
        <>
          <div className={styles.stats}>
            <StatCard label="Enquiries" value={data.totals.messages} hint="messages received" icon={<Inbox />} />
            <StatCard label="Contacts" value={data.totals.contacts} hint={`${data.totals.careers} careers · ${data.totals.spam} spam`} icon={<Users />} />
            <StatCard label="Sales" value={data.totals.sales} hint="contacts in the period" icon={<ShoppingBag />} tone="brand" />
            <StatCard label="Support" value={data.totals.support} hint="need human review" icon={<Headset />} tone={data.totals.support ? "danger" : "neutral"} />
            <StatCard label="Overdue today" value={data.totals.overdueNow} hint="across all contacts" icon={<BellRing />} tone={data.totals.overdueNow ? "warning" : "neutral"} />
          </div>

          <div className={styles.columns}>
            <Card>
              <CardHeader
                icon={<ListChecks />}
                title="Priorities this week"
                description="Totals are calculated from the data; only these priorities are written by AI or rules."
                action={
                  <Badge tone={data.mode === "live" ? "success" : "neutral"} variant="outline">
                    {data.mode === "live" ? "Live AI" : "Rule-based"}
                  </Badge>
                }
              />
              {data.notice && <p className={styles.notice}>{data.notice}</p>}
              <ol className={styles.priorities}>
                {data.priorities.map((priority, index) => (
                  <li key={index}>
                    <span className={styles.number}>{index + 1}</span>
                    <p>{priority}</p>
                  </li>
                ))}
              </ol>
              <p className={styles.generated}>Generated {formatDateTime(data.generatedAt)}</p>
            </Card>

            <div className={styles.side}>
              <Card>
                <CardHeader title="Sales interest by programme" />
                {data.totals.sales === 0 ? (
                  <p className={styles.muted}>No sales enquiries in this period.</p>
                ) : (
                  <ul className={styles.bars}>
                    {(Object.entries(data.programmes) as [Programme, number][]).map(([programme, count]) => (
                      <li key={programme}>
                        <span className={styles.barLabel}>{programme === "Unspecified" ? "To confirm" : programme}</span>
                        <span className={styles.barTrack}>
                          <span
                            className={programme === "Unspecified" ? styles.barFillMuted : styles.barFill}
                            style={{ width: `${(count / maxProgramme) * 100}%` }}
                          />
                        </span>
                        <span className={`${styles.barValue} tabular`}>{count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card>
                <CardHeader title="Support cases" description="Never marked paid without a human check" />
                {data.supportCases.length ? (
                  <ul className={styles.cases}>
                    {data.supportCases.map((c) => (
                      <li key={c.id}>
                        <button type="button" onClick={() => open(c.id)}>
                          <span>{c.name}</span>
                          <span className={styles.caseBadges}>
                            {c.priority === "Urgent" && <Badge tone="danger" size="sm">Urgent</Badge>}
                            <Badge tone={c.status === "Resolved" ? "success" : "warning"} size="sm">
                              {c.status}
                            </Badge>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.muted}>No support cases in this period.</p>
                )}
              </Card>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
