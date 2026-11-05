import { useMemo } from "react";
import { NavLink } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  BellRing,
  ChevronsUpDown,
  ExternalLink,
  Inbox,
  KanbanSquare,
  LogOut,
  MessagesSquare,
  RotateCcw,
  Users,
  Workflow,
} from "lucide-react";
import { adminApi, automationApi } from "@/api/endpoints";
import { Avatar, Menu, useToast } from "@/components/ui";
import { useAuth, useCurrentUser } from "@/features/auth/AuthProvider";
import { queryKeys, useLeads, useMeta } from "@/hooks/queries";
import { cx } from "@/lib/cx";
import { isOverdue } from "@/lib/lead";
import { Logo } from "./Logo";
import styles from "./Sidebar.module.css";

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  count?: number;
  tone?: "warning" | "neutral";
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const user = useCurrentUser();
  const { signOut } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const meta = useMeta();
  const leads = useLeads();
  const automation = useQuery({ queryKey: queryKeys.automation, queryFn: automationApi.get, refetchInterval: 30_000 });

  const counts = useMemo(() => {
    const all = leads.data ?? [];
    return {
      pipeline: all.filter((l) => l.route === "Sales").length,
      overdue: all.filter((l) => isOverdue(l)).length,
      review: automation.data?.jobs.filter((j) => j.status === "Pending").length ?? 0,
    };
  }, [leads.data, automation.data]);

  const sections: { title: string; items: NavItem[] }[] = [
    {
      title: "Workspace",
      items: [
        { to: "/pipeline", label: "Pipeline", icon: <KanbanSquare />, count: counts.pipeline, tone: "neutral" },
        { to: "/enquiries", label: "All enquiries", icon: <Inbox /> },
        { to: "/follow-ups", label: "Follow-ups", icon: <BellRing />, count: counts.overdue, tone: "warning" },
      ],
    },
    { title: "Insights", items: [{ to: "/brief", label: "Weekly brief", icon: <BarChart3 /> }] },
    {
      title: "Tools",
      items: [
        { to: "/automation", label: "Automation", icon: <Workflow />, count: counts.review, tone: "warning" },
        { to: "/team", label: "Team", icon: <Users /> },
      ],
    },
  ];

  const ai = meta.data?.ai;

  async function restoreSamples() {
    if (!window.confirm("Restore the 20 sample enquiries? This removes every contact and automation result added since.")) return;
    try {
      await adminApi.resetDemo();
      await queryClient.invalidateQueries();
      toast.success("Sample data restored.");
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return (
    <div className={styles.sidebar}>
      <div className={styles.brand}>
        <Logo />
      </div>

      <nav className={styles.nav} aria-label="Main">
        {sections.map((section) => (
          <div key={section.title} className={styles.section}>
            <p className={styles.sectionTitle}>{section.title}</p>
            <ul>
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={onNavigate}
                    className={({ isActive }) => cx(styles.link, isActive && styles.active)}
                  >
                    {item.icon}
                    <span className={styles.linkLabel}>{item.label}</span>
                    {!!item.count && (
                      <span className={cx(styles.count, item.tone === "warning" && styles.countWarning, "tabular")}>
                        {item.count}
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
              {section.title === "Tools" && meta.data?.simulatorUrl && (
                <li>
                  <a className={styles.link} href={meta.data.simulatorUrl} target="_blank" rel="noopener noreferrer">
                    <MessagesSquare />
                    <span className={styles.linkLabel}>Channel simulator</span>
                    <ExternalLink className={styles.external} aria-label="opens in a new tab" />
                  </a>
                </li>
              )}
            </ul>
          </div>
        ))}
      </nav>

      <div className={styles.footer}>
        {ai && (
          <div className={styles.status} title={ai.mode === "live" ? `${ai.provider} · ${ai.model}` : "No AI key configured"}>
            <span className={cx(styles.statusDot, ai.mode === "live" && styles.statusLive)} />
            <span>{ai.mode === "live" ? `Live AI · ${ai.provider}` : "Rule-based mode · no AI key"}</span>
          </div>
        )}
        <Menu
          placement="top-start"
          className={styles.accountMenu}
          header={
            <div className={styles.menuHeader}>
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>
          }
          items={[
            ...(user.role === "Admin"
              ? [{ label: "Restore sample data", icon: <RotateCcw />, onSelect: restoreSamples }, "divider" as const]
              : []),
            { label: "Sign out", icon: <LogOut />, onSelect: signOut },
          ]}
          trigger={(props) => (
            <button type="button" className={styles.account} {...props}>
              <Avatar name={user.name} size="sm" />
              <span className={styles.accountText}>
                <span className={styles.accountName}>{user.name}</span>
                <span className={styles.accountRole}>{user.role}</span>
              </span>
              <ChevronsUpDown className={styles.accountChevron} />
            </button>
          )}
        />
      </div>
    </div>
  );
}
