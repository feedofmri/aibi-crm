import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { BellRing, Columns3, Headset, List, Plus, UserRoundCheck, Users } from "lucide-react";
import { Button, EmptyState, PageLoader, Segmented, StatCard, StatGrid } from "@/components/ui";
import { PageHeader } from "@/components/layout/PageHeader";
import { useShell } from "@/components/layout/ShellContext";
import { useLeads } from "@/hooks/queries";
import { isOverdue } from "@/lib/lead";
import { LeadTable } from "@/features/leads/LeadTable";
import { LeadToolbar } from "@/features/leads/LeadToolbar";
import { useLeadFilters } from "@/features/leads/useLeadFilters";
import { KanbanBoard } from "./KanbanBoard";

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
  const navigate = useNavigate();
  const leads = useLeads();
  const [view, setView] = useState<View>(initialView);

  const sales = useMemo(() => (leads.data ?? []).filter((l) => l.route === "Sales"), [leads.data]);
  const filters = useLeadFilters(sales);

  const stats = useMemo(() => {
    const all = leads.data ?? [];
    return {
      contacts: all.length,
      messages: all.reduce((n, l) => n + l.messages.length, 0),
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
        description="Sales enquiries by stage. Drag a card to move it, or open it to reply."
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
          <StatGrid>
            <StatCard label="Contacts" value={stats.contacts} hint={`from ${stats.messages} enquiries`} icon={<Users />} />
            <StatCard label="Active in pipeline" value={stats.active} hint="not yet paid or lost" icon={<UserRoundCheck />} tone="brand" />
            <StatCard
              label="Follow-ups due"
              value={stats.overdue}
              hint="48-hour rule or scheduled date"
              icon={<BellRing />}
              tone={stats.overdue ? "warning" : "neutral"}
              onClick={() => navigate("/follow-ups")}
            />
            <StatCard
              label="Open support cases"
              value={stats.support}
              hint="payments and cancellations"
              icon={<Headset />}
              tone={stats.support ? "danger" : "neutral"}
              onClick={() => navigate("/follow-ups")}
            />
          </StatGrid>

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
