import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, ExternalLink, RotateCcw } from "lucide-react";
import { automationApi } from "@/api/endpoints";
import { Badge, Button, Field, Input, Select, Textarea, useToast } from "@/components/ui";
import { queryKeys, useMeta } from "@/hooks/queries";
import { useContactSheet } from "@/hooks/useContactSheet";
import { formatRelative } from "@/lib/format";
import { cx } from "@/lib/cx";
import type { Tone } from "@/lib/lead";
import type { Analysis, AutomationJob } from "@/types";
import { ChannelIcon } from "@/features/leads/LeadBits";
import styles from "./JobCard.module.css";

const STATUS: Record<AutomationJob["status"], { label: string; tone: Tone }> = {
  Processing: { label: "Processing", tone: "info" },
  Pending: { label: "Needs review", tone: "warning" },
  Completed: { label: "Saved automatically", tone: "success" },
  Approved: { label: "Approved", tone: "success" },
  Rejected: { label: "Rejected", tone: "neutral" },
  Failed: { label: "Failed", tone: "danger" },
};

export function JobCard({ job }: { job: AutomationJob }) {
  const meta = useMeta();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { open } = useContactSheet();
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<Analysis | null>(job.result);
  const [busy, setBusy] = useState<"approve" | "reject" | "retry" | null>(null);
  const status = STATUS[job.status];

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.automation }),
      queryClient.invalidateQueries({ queryKey: queryKeys.leads }),
    ]);
  }

  async function review(action: "approve" | "reject", event?: FormEvent) {
    event?.preventDefault();
    setBusy(action);
    try {
      await automationApi.review(job.id, action, action === "approve" && draft ? draft : undefined);
      await refresh();
      toast.success(action === "approve" ? "Approved and saved to contacts." : "Rejected. Nothing was saved.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function retry() {
    setBusy("retry");
    try {
      await automationApi.process(job.input);
      await refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const set = <K extends keyof Analysis>(key: K, value: Analysis[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));

  return (
    <article className={cx(styles.card, job.status === "Pending" && styles.pending)}>
      <header className={styles.header}>
        <div className={styles.who}>
          <ChannelIcon channel={job.input.channel} />
          <strong>{job.input.name ? job.input.name.split(" (")[0] : "Unknown sender"}</strong>
          <span className={styles.meta}>
            {job.input.channel} · {formatRelative(job.createdAt)}
          </span>
        </div>
        <Badge tone={status.tone} dot>
          {status.label}
        </Badge>
      </header>

      <p className={styles.message}>{job.input.message}</p>

      {job.reasons.length > 0 && job.status === "Pending" && (
        <ul className={styles.reasons} aria-label="Why it needs review">
          {job.reasons.map((reason) => (
            <li key={reason}>
              <AlertTriangle aria-hidden />
              {reason}
            </li>
          ))}
        </ul>
      )}

      {job.status === "Failed" && (
        <div className={styles.failure}>
          <span>{job.error}</span>
          <Button size="sm" icon={<RotateCcw />} loading={busy === "retry"} onClick={retry}>
            Retry
          </Button>
        </div>
      )}

      {(job.status === "Completed" || job.status === "Approved") && job.leadId && (
        <button type="button" className={styles.link} onClick={() => open(job.leadId)}>
          Open contact <ExternalLink />
        </button>
      )}

      {job.status === "Pending" && draft && (
        <>
          <button type="button" className={styles.toggle} onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
            {expanded ? "Hide details" : "Review details and reply"}
            <ChevronDown className={cx(styles.chevron, expanded && styles.chevronUp)} />
          </button>
          {expanded ? (
            <form className={styles.review} onSubmit={(e) => review("approve", e)}>
              <div className={styles.grid}>
                <Field label="Name">{(id) => <Input id={id} value={draft.name} onChange={(e) => set("name", e.target.value)} />}</Field>
                <Field label="Phone" optional>
                  {(id) => <Input id={id} inputMode="tel" value={draft.phone} onChange={(e) => set("phone", e.target.value)} />}
                </Field>
                <Field label="Programme">
                  {(id) => (
                    <Select id={id} value={draft.program} onChange={(e) => set("program", e.target.value as Analysis["program"])}>
                      {meta.data?.programs.map((p) => <option key={p} value={p}>{p === "Unspecified" ? "To confirm" : p}</option>)}
                    </Select>
                  )}
                </Field>
                <Field label="Queue">
                  {(id) => (
                    <Select id={id} value={draft.route} onChange={(e) => set("route", e.target.value as Analysis["route"])}>
                      {meta.data?.routes.map((r) => <option key={r}>{r}</option>)}
                    </Select>
                  )}
                </Field>
              </div>
              <Field label="Reply draft" optional>
                {(id) => <Textarea id={id} rows={3} value={draft.reply} onChange={(e) => set("reply", e.target.value)} />}
              </Field>
              <div className={styles.actions}>
                <Button variant="ghost" loading={busy === "reject"} disabled={busy !== null} onClick={() => review("reject")}>
                  Reject
                </Button>
                <Button variant="primary" type="submit" loading={busy === "approve"} disabled={busy !== null}>
                  Approve and save
                </Button>
              </div>
            </form>
          ) : (
            <div className={styles.summary}>
              <span>
                {draft.program === "Unspecified" ? "Programme to confirm" : draft.program} · {draft.route} · {draft.language}
              </span>
            </div>
          )}
        </>
      )}
    </article>
  );
}
