import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, CheckCircle2, Hand, MessageSquareReply, PlayCircle, ShieldCheck, Workflow, Zap } from "lucide-react";
import { automationApi } from "@/api/endpoints";
import { Button, Card, CardHeader, EmptyState, PageLoader, Segmented, useToast } from "@/components/ui";
import { PageHeader } from "@/components/layout/PageHeader";
import { useCurrentUser } from "@/features/auth/AuthProvider";
import { queryKeys, useMeta } from "@/hooks/queries";
import { cx } from "@/lib/cx";
import type { AutoReplyMode } from "@/types";
import { JobCard } from "./JobCard";
import styles from "./AutomationPage.module.css";

type Mode = "manual" | "automatic";
type Filter = "review" | "all";

interface Option<T extends string> {
  value: T;
  title: string;
  text: string;
  icon: React.ReactNode;
}

const AUTO_REPLY: Option<AutoReplyMode>[] = [
  {
    value: "off",
    title: "Drafts only",
    text: "Every inbound message gets a reply draft. A person reviews it and sends it.",
    icon: <Hand />,
  },
  {
    value: "safe",
    title: "Send safe replies automatically",
    text: "Clear-cut sales questions are answered at once. Everything else is held for a person.",
    icon: <Bot />,
  },
];

const AUTO_REPLY_RULES = [
  "Live AI with high confidence (never a rule-based draft)",
  "A sales enquiry, not support, careers or spam, and not urgent",
  "Passes the reply check: no prices, dates, guarantees, payment confirmations or outside links, in the right language",
  "The contact is not assigned to a team member, paid or lost",
  "At most two automatic replies in a row; then a person takes over",
];

/** A set of mutually exclusive option cards (radio group). */
function OptionCards<T extends string>({
  label,
  options,
  value,
  disabled,
  onChange,
}: {
  label: string;
  options: Option<T>[];
  value: T;
  disabled: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <div className={styles.modes} role="radiogroup" aria-label={label}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            className={cx(styles.mode, selected && styles.modeSelected)}
            onClick={() => onChange(option.value)}
          >
            <span className={styles.modeIcon}>{option.icon}</span>
            <span className={styles.modeText}>
              <strong>{option.title}</strong>
              <span>{option.text}</span>
            </span>
            <span className={styles.radio} aria-hidden>
              {selected && <CheckCircle2 />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const MODES: Option<Mode>[] = [
  {
    value: "manual",
    title: "Manual review",
    text: "Every extracted enquiry waits for a person to check and approve it.",
    icon: <Hand />,
  },
  {
    value: "automatic",
    title: "Automatic, with exceptions",
    text: "Complete new sales enquiries are saved with a 48-hour follow-up. Anything incomplete, non-sales or matching an existing contact waits for review.",
    icon: <Zap />,
  },
];

export function AutomationPage() {
  const user = useCurrentUser();
  const meta = useMeta();
  const toast = useToast();
  const queryClient = useQueryClient();
  const automation = useQuery({ queryKey: queryKeys.automation, queryFn: automationApi.get });
  const [filter, setFilter] = useState<Filter>("review");
  const [savingMode, setSavingMode] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const canChangeMode = user.role === "Admin" || user.role === "Admissions";
  const jobs = automation.data?.jobs ?? [];
  const pending = useMemo(() => jobs.filter((j) => j.status === "Pending"), [jobs]);
  const visible = filter === "review" ? pending : jobs;

  async function changeMode(mode: Mode) {
    if (!canChangeMode || mode === automation.data?.settings.mode) return;
    setSavingMode(true);
    try {
      await automationApi.setMode(mode);
      await queryClient.invalidateQueries({ queryKey: queryKeys.automation });
      toast.success(mode === "automatic" ? "Automatic processing is on." : "Every enquiry will now wait for review.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSavingMode(false);
    }
  }

  async function changeAutoReply(autoReply: AutoReplyMode) {
    if (!canChangeMode || autoReply === automation.data?.settings.autoReply) return;
    setSavingMode(true);
    try {
      await automationApi.setAutoReply(autoReply);
      await queryClient.invalidateQueries({ queryKey: queryKeys.automation });
      toast.success(autoReply === "safe" ? "Safe auto-replies are on." : "Auto-reply is off. Replies wait as drafts.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSavingMode(false);
    }
  }

  async function processSamples() {
    const samples = meta.data?.samples ?? [];
    setProgress({ done: 0, total: samples.length });
    let failed = 0;
    for (const [index, sample] of samples.entries()) {
      try {
        const job = await automationApi.process({ message: sample.message, channel: sample.channel, name: sample.name, phone: sample.phone });
        if (job.status === "Failed") failed += 1;
      } catch {
        failed += 1;
      }
      setProgress({ done: index + 1, total: samples.length });
      await queryClient.invalidateQueries({ queryKey: queryKeys.automation });
    }
    await queryClient.invalidateQueries({ queryKey: queryKeys.leads });
    setProgress(null);
    if (failed) toast.error(`${failed} message${failed === 1 ? "" : "s"} failed. Retry them from the list.`);
    else toast.success("All sample messages processed.");
  }

  const mode = automation.data?.settings.mode ?? "manual";
  const autoReply = automation.data?.settings.autoReply ?? "off";

  return (
    <>
      <PageHeader
        eyebrow="Intake"
        title="Automation"
        description="Extract, classify and draft replies for incoming enquiries. Payment claims never mark a contact paid."
      />

      {automation.isPending ? (
        <PageLoader label="Loading automation" />
      ) : (
        <>
          <div className={styles.top}>
            <Card>
              <CardHeader
                icon={<ShieldCheck />}
                title="Processing mode"
                description={canChangeMode ? "Choose how much a person checks before saving." : "Only Admin and Admissions can change this."}
              />
              <OptionCards label="Processing mode" options={MODES} value={mode} disabled={!canChangeMode || savingMode} onChange={changeMode} />
            </Card>

            <Card>
              <CardHeader icon={<PlayCircle />} title="Try it with the sample data" description="Runs the 20 supplied messages through automation, one by one. Messages already processed are skipped." />
              {progress ? (
                <div className={styles.progress} role="status">
                  <div className={styles.progressTrack}>
                    <span style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }} />
                  </div>
                  <span className="tabular">
                    Processing {progress.done} of {progress.total}…
                  </span>
                </div>
              ) : (
                <Button icon={<PlayCircle />} onClick={processSamples} disabled={!meta.data}>
                  Process sample messages
                </Button>
              )}
            </Card>
          </div>

          <Card className={styles.autoReply}>
            <CardHeader
              icon={<MessageSquareReply />}
              title="Auto-reply to inbound messages"
              description={
                canChangeMode
                  ? "For messages arriving through a channel (the simulator today). Pasted enquiries are never auto-answered."
                  : "Only Admin and Admissions can change this."
              }
            />
            <div className={styles.autoReplyBody}>
              <OptionCards
                label="Auto-reply"
                options={AUTO_REPLY}
                value={autoReply}
                disabled={!canChangeMode || savingMode}
                onChange={changeAutoReply}
              />
              <div className={styles.rules}>
                <strong>A reply is only sent automatically when all of these hold:</strong>
                <ul>
                  {AUTO_REPLY_RULES.map((rule) => (
                    <li key={rule}>
                      <CheckCircle2 aria-hidden />
                      {rule}
                    </li>
                  ))}
                </ul>
                <p>Sent replies appear in the contact's conversation and count as contact. Held ones stay as drafts, with the reason in the activity log.</p>
              </div>
            </div>
          </Card>

          <div className={styles.listHeader}>
            <Segmented<Filter>
              variant="tabs"
              label="Show"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "review", label: "Needs review", count: pending.length },
                { value: "all", label: "All results", count: jobs.length },
              ]}
            />
          </div>

          {visible.length ? (
            <div className={styles.jobs}>
              {visible.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Workflow />}
              title={filter === "review" ? "Nothing waiting for review" : "Nothing processed yet"}
              description={filter === "review" ? "New exceptions will appear here." : "Process the sample messages to see automation at work."}
            />
          )}
        </>
      )}
    </>
  );
}
