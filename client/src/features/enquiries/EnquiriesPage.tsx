import { useMemo, useState } from "react";
import { Inbox, Plus } from "lucide-react";
import { Button, EmptyState, PageLoader, Segmented } from "@/components/ui";
import { PageHeader } from "@/components/layout/PageHeader";
import { useShell } from "@/components/layout/ShellContext";
import { useLeads } from "@/hooks/queries";
import { LeadTable } from "@/features/leads/LeadTable";
import { LeadToolbar } from "@/features/leads/LeadToolbar";
import { useLeadFilters } from "@/features/leads/useLeadFilters";
import type { Queue } from "@/types";
import styles from "./EnquiriesPage.module.css";

type Tab = Queue | "All";
const TABS: Tab[] = ["All", "Sales", "Support", "Careers", "Spam"];

export function EnquiriesPage() {
  const { openIntake } = useShell();
  const leads = useLeads();
  const [tab, setTab] = useState<Tab>("All");
  const filters = useLeadFilters(leads.data);

  const counts = useMemo(() => {
    const result = Object.fromEntries(TABS.map((t) => [t, 0])) as Record<Tab, number>;
    for (const lead of filters.filtered) {
      result.All += 1;
      result[lead.route] += 1;
    }
    return result;
  }, [filters.filtered]);

  const visible = tab === "All" ? filters.filtered : filters.filtered.filter((l) => l.route === tab);

  return (
    <>
      <PageHeader
        title="All enquiries"
        description="Every contact across sales, support, careers and spam, with the original messages kept."
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
          <Segmented<Tab>
            variant="tabs"
            label="Queue"
            className={styles.tabs}
            value={tab}
            onChange={setTab}
            options={TABS.map((t) => ({ value: t, label: t === "All" ? "All queues" : t, count: counts[t] }))}
          />
          <LeadToolbar filters={filters} resultCount={visible.length} />
          {visible.length ? (
            <LeadTable leads={visible} showQueue={tab === "All"} caption={`${tab} enquiries`} />
          ) : (
            <EmptyState
              icon={<Inbox />}
              title={filters.active ? "No contacts match these filters" : `No ${tab === "All" ? "" : tab.toLowerCase() + " "}enquiries`}
              action={filters.active ? <Button onClick={filters.reset}>Clear filters</Button> : undefined}
            />
          )}
        </>
      )}
    </>
  );
}
