import { useMemo, useState, type ReactNode } from "react";
import { Check, CircleCheck, Flame, Headset, Info, ShoppingBag, CalendarClock } from "lucide-react";
import { Button, EmptyState, PageLoader, useToast } from "@/components/ui";
import { PageHeader } from "@/components/layout/PageHeader";
import { leadsApi } from "@/api/endpoints";
import { useLeads, useReplaceLead } from "@/hooks/queries";
import { dueAt, followUpState, needsFollowUp, splitName } from "@/lib/lead";
import { pluralize } from "@/lib/format";
import { LeadTable } from "@/features/leads/LeadTable";
import type { Lead } from "@/types";
import styles from "./FollowUpsPage.module.css";

const WEEK = 7 * 24 * 3_600_000;

export function FollowUpsPage() {
  const leads = useLeads();
  const replace = useReplaceLead();
  const toast = useToast();
  const [logging, setLogging] = useState<string | null>(null);

  const groups = useMemo(() => {
    const now = Date.now();
    const open = (leads.data ?? []).filter(needsFollowUp);
    const overdue = open.filter((l) => followUpState(l, now).kind === "overdue").sort((a, b) => dueAt(a) - dueAt(b));
    return {
      urgent: overdue.filter((l) => l.priority === "Urgent"),
      support: overdue.filter((l) => l.priority !== "Urgent" && l.route === "Support"),
      sales: overdue.filter((l) => l.priority !== "Urgent" && l.route === "Sales"),
      upcoming: open
        .filter((l) => followUpState(l, now).kind !== "overdue" && dueAt(l) - now < WEEK)
        .sort((a, b) => dueAt(a) - dueAt(b)),
      overdueCount: overdue.length,
    };
  }, [leads.data]);

  async function logContact(lead: Lead) {
    setLogging(lead.id);
    try {
      replace(await leadsApi.logContact(lead.id));
      toast.success(`Contact with ${splitName(lead.name).primary} logged. Next follow-up in 48 hours.`);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLogging(null);
    }
  }

  const logButton = (lead: Lead) => (
    <Button size="sm" icon={<Check />} loading={logging === lead.id} onClick={() => logContact(lead)}>
      Log contact
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Follow-ups"
        description="Contacts with no logged contact for 48 hours, or whose scheduled follow-up is due. Urgent and support cases come first."
      />

      {leads.isPending ? (
        <PageLoader label="Loading follow-ups" />
      ) : (
        <>
          <div className={styles.notice}>
            <Info aria-hidden />
            <p>
              <strong>{pluralize(groups.overdueCount, "contact")} need a reply.</strong> Use <em>Log contact</em> only after you
              have actually reached the person; copying a draft doesn&apos;t count. Paid, lost, careers and spam contacts are
              excluded.
            </p>
          </div>

          {groups.overdueCount === 0 && (
            <EmptyState icon={<CircleCheck />} title="You're all caught up" description="No follow-ups are due right now." />
          )}

          <Group icon={<Flame />} tone="danger" title="Urgent" leads={groups.urgent} action={logButton} />
          <Group icon={<Headset />} tone="danger" title="Support cases" description="Verify payment or cancellation claims with a person." leads={groups.support} action={logButton} />
          <Group icon={<ShoppingBag />} tone="brand" title="Sales enquiries" leads={groups.sales} action={logButton} />
          <Group icon={<CalendarClock />} tone="neutral" title="Coming up this week" leads={groups.upcoming} />
        </>
      )}
    </>
  );
}

interface GroupProps {
  icon: ReactNode;
  title: string;
  description?: string;
  tone: "danger" | "brand" | "neutral";
  leads: Lead[];
  action?: (lead: Lead) => ReactNode;
}

function Group({ icon, title, description, tone, leads, action }: GroupProps) {
  if (!leads.length) return null;
  return (
    <section className={styles.group} aria-label={title}>
      <header className={styles.groupHeader}>
        <span className={`${styles.groupIcon} ${styles[tone]}`}>{icon}</span>
        <h2 className={styles.groupTitle}>{title}</h2>
        <span className={styles.groupCount}>{leads.length}</span>
        {description && <span className={styles.groupDescription}>{description}</span>}
      </header>
      <LeadTable leads={leads} rowAction={action} caption={title} />
    </section>
  );
}
