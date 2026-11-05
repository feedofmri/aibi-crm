import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Hand, PlayCircle, ShieldCheck, Workflow, Zap } from "lucide-react";
import { automationApi } from "@/api/endpoints";
import { Button, Card, CardHeader, EmptyState, PageLoader, Segmented, useToast } from "@/components/ui";
import { PageHeader } from "@/components/layout/PageHeader";
import { useCurrentUser } from "@/features/auth/AuthProvider";
import { queryKeys, useMeta } from "@/hooks/queries";
import { cx } from "@/lib/cx";
import { JobCard } from "./JobCard";
import styles from "./AutomationPage.module.css";

type Mode = "manual" | "automatic";
type Filter = "review" | "all";

const MODES: { value: Mode; title: string; text: string; icon: React.ReactNode }[] = [
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

  return (
    <>
      <PageHeader
        eyebrow="Intake"
        title="Automation"
        description="Extract, classify and draft replies for incoming enquiries. Nothing is ever sent, and payment claims never mark a contact paid."
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
              <div className={styles.modes} role="radiogroup" aria-label="Processing mode">
                {MODES.map((option) => {
                  const selected = mode === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={!canChangeMode || savingMode}
                      className={cx(styles.mode, selected && styles.modeSelected)}
                      onClick={() => changeMode(option.value)}
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
