import { useMemo, useState } from "react";
import { Link } from "react-router";
import { BellRing, ChevronRight, Columns3, Headset, List, Plus, Users } from "lucide-react";
import { Button, EmptyState, PageLoader, Segmented } from "@/components/ui";
import { PageHeader } from "@/components/layout/PageHeader";
import { useShell } from "@/components/layout/ShellContext";
import { useLeads } from "@/hooks/queries";
import { inboundMessages, isOverdue } from "@/lib/lead";
import { LeadTable } from "@/features/leads/LeadTable";
import { LeadToolbar } from "@/features/leads/LeadToolbar";
import { useLeadFilters } from "@/features/leads/useLeadFilters";
import { KanbanBoard } from "./KanbanBoard";
import styles from "./PipelinePage.module.css";

type View = "board" | "list";
const VIEW_KEY = "biai.pipeline.view";

function initialView(): View {
  try {
    const saved = localStorage.getItem(VIEW_KEY);
    if (saved === "board" || saved === "list") return saved;
  } catch {
    /* storage unavailable */
  }
  return window.matchMedia?.("(max-width: 640px)").matches ? "list" : "board";
}

export function PipelinePage() {
  const { openIntake } = useShell();
  const leads = useLeads();
  const [view, setView] = useState<View>(initialView);

  const sales = useMemo(() => (leads.data ?? []).filter((l) => l.route === "Sales"), [leads.data]);
  const filters = useLeadFilters(sales);

  const stats = useMemo(() => {
    const all = leads.data ?? [];
    return {
      contacts: all.length,
      messages: all.reduce((n, l) => n + inboundMessages(l).length, 0),
      active: sales.filter((l) => l.status !== "Paid" && l.status !== "Lost").length,
      overdue: all.filter((l) => isOverdue(l)).length,
      support: all.filter((l) => l.route === "Support" && l.supportStatus === "Open").length,
    };
  }, [leads.data, sales]);

  function changeView(next: View) {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <PageHeader
        title="Pipeline"
        description={
          leads.isPending ? undefined : (
            <span className={styles.summary}>
              <span className={styles.stat}>
                <strong className="tabular">{stats.active}</strong> active of {stats.contacts} contacts
              </span>
              {stats.overdue > 0 && (
                <Link to="/follow-ups" className={styles.alert} data-tone="warning">
                  <BellRing aria-hidden />
                  <strong className="tabular">{stats.overdue}</strong> follow-ups due
                  <ChevronRight aria-hidden className={styles.chevron} />
                </Link>
              )}
              {stats.support > 0 && (
                <Link to="/follow-ups" className={styles.alert} data-tone="danger">
                  <Headset aria-hidden />
                  <strong className="tabular">{stats.support}</strong> open support {stats.support === 1 ? "case" : "cases"}
                  <ChevronRight aria-hidden className={styles.chevron} />
                </Link>
              )}
            </span>
          )
        }
        actions={
          <Button variant="primary" icon={<Plus />} onClick={openIntake}>
            New enquiry
          </Button>
        }
      />

      {leads.isPending ? (
        <PageLoader label="Loading contacts" />
      ) : (
        <>
          <LeadToolbar filters={filters} resultCount={filters.filtered.length}>
            <Segmented<View>
              label="Pipeline view"
              value={view}
              onChange={changeView}
              options={[
                { value: "board", label: "Board", icon: <Columns3 /> },
                { value: "list", label: "List", icon: <List /> },
              ]}
            />
          </LeadToolbar>

          {sales.length === 0 ? (
            <EmptyState
              icon={<Users />}
              title="No sales enquiries yet"
              description="Add an enquiry to start the pipeline."
              action={
                <Button variant="primary" icon={<Plus />} onClick={openIntake}>
                  New enquiry
                </Button>
              }
            />
          ) : view === "board" ? (
            <KanbanBoard leads={filters.filtered} />
          ) : filters.filtered.length ? (
            <LeadTable leads={filters.filtered} showQueue={false} caption="Sales pipeline" />
          ) : (
            <EmptyState title="No contacts match these filters" action={<Button onClick={filters.reset}>Clear filters</Button>} />
          )}
        </>
      )}
    </>
  );
}
