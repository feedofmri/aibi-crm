import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button, Card, Field, Input, Select, Textarea, useToast } from "@/components/ui";
import { ApiError } from "@/api/http";
import { useMutation } from "@tanstack/react-query";
import { leadsApi } from "@/api/endpoints";
import { useMeta, useReplaceLead, useTeam } from "@/hooks/queries";
import { formatLongDate, fromDhakaInputValue, toDhakaInputValue } from "@/lib/format";
import type { Lead, LeadChanges } from "@/types";
import styles from "./DetailsForm.module.css";

type FormState = {
  status: Lead["status"];
  supportStatus: Lead["supportStatus"];
  priority: Lead["priority"];
  owner: string;
  nextAction: string;
  nextFollowUp: string; // datetime-local value, Dhaka time
  name: string;
  phone: string;
  program: Lead["program"];
  route: Lead["route"];
  language: Lead["language"];
  notes: string;
};

const fromLead = (lead: Lead): FormState => ({
  status: lead.status,
  supportStatus: lead.supportStatus,
  priority: lead.priority,
  owner: lead.owner,
  nextAction: lead.nextAction,
  nextFollowUp: toDhakaInputValue(lead.nextFollowUp),
  name: lead.name,
  phone: lead.phone,
  program: lead.program,
  route: lead.route,
  language: lead.language,
  notes: lead.notes,
});

export function DetailsForm({ lead }: { lead: Lead }) {
  const meta = useMeta();
  const team = useTeam();
  const replace = useReplaceLead();
  const update = useMutation({
    mutationFn: (changes: LeadChanges) => leadsApi.update(lead.id, changes),
    onSuccess: (updated) => replace(updated),
  });
  const toast = useToast();
  const initial = useMemo(() => fromLead(lead), [lead]);
  const [form, setForm] = useState<FormState>(initial);
  const [fieldError, setFieldError] = useState<{ field?: string; message: string } | null>(null);

  useEffect(() => setForm(initial), [initial]);

  const changes = useMemo(() => {
    const result: LeadChanges = {};
    for (const key of Object.keys(form) as (keyof FormState)[]) {
      if (form[key] === initial[key]) continue;
      if (key === "nextFollowUp") result.nextFollowUp = fromDhakaInputValue(form.nextFollowUp);
      else (result as Record<string, string>)[key] = form[key];
    }
    return result;
  }, [form, initial]);
  const dirty = Object.keys(changes).length > 0;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldError(null);
  };

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!dirty) return;
    update.mutate(changes, {
      onSuccess: () => toast.success("Changes saved."),
      onError: (error) =>
        setFieldError({ field: error instanceof ApiError ? error.field : undefined, message: error.message }),
    });
  }

  const owners = useMemo(() => {
    const names = new Set((team.data ?? []).map((u) => u.name));
    if (lead.owner) names.add(lead.owner);
    return [...names].sort();
  }, [team.data, lead.owner]);

  const errorFor = (field: string) => (fieldError?.field === field ? fieldError.message : undefined);

  return (
    <Card className={styles.card} padded={false}>
      <form onSubmit={submit} className={styles.form}>
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Follow-up</h3>
          {lead.route === "Support" ? (
            <Field label="Support case">
              {(id) => (
                <Select id={id} value={form.supportStatus} onChange={(e) => set("supportStatus", e.target.value as FormState["supportStatus"])}>
                  <option value="Open">Open</option>
                  <option value="Resolved">Resolved</option>
                </Select>
              )}
            </Field>
          ) : (
            <Field label="Stage" hint={lead.route !== "Sales" ? "Only sales contacts appear in the pipeline." : undefined}>
              {(id, hint) => (
                <Select id={id} aria-describedby={hint} value={form.status} onChange={(e) => set("status", e.target.value as FormState["status"])}>
                  {meta.data?.stages.map((s) => <option key={s}>{s}</option>)}
                </Select>
              )}
            </Field>
          )}
          <div className={styles.row}>
            <Field label="Owner">
              {(id) => (
                <Select id={id} value={form.owner} onChange={(e) => set("owner", e.target.value)}>
                  <option value="">Unassigned</option>
                  {owners.map((name) => <option key={name}>{name}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Priority">
              {(id) => (
                <Select id={id} value={form.priority} onChange={(e) => set("priority", e.target.value as FormState["priority"])}>
                  <option>Normal</option>
                  <option>Urgent</option>
                </Select>
              )}
            </Field>
          </div>
          <Field label="Next action" optional>
            {(id) => (
              <Input id={id} value={form.nextAction} maxLength={500} placeholder="e.g. Call after 5 PM about fees" onChange={(e) => set("nextAction", e.target.value)} />
            )}
          </Field>
          <Field
            label="Next follow-up"
            optional
            hint={form.nextFollowUp ? `${formatLongDate(fromDhakaInputValue(form.nextFollowUp))} (Dhaka time)` : "Leave empty to use the 48-hour rule."}
            action={
              form.nextFollowUp ? (
                <button type="button" className={styles.clear} onClick={() => set("nextFollowUp", "")}>
                  Clear
                </button>
              ) : undefined
            }
          >
            {(id, hint) => (
              <Input id={id} type="datetime-local" aria-describedby={hint} value={form.nextFollowUp} onChange={(e) => set("nextFollowUp", e.target.value)} />
            )}
          </Field>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Contact details</h3>
          <Field label="Name" error={errorFor("name")}>
            {(id, hint) => <Input id={id} aria-describedby={hint} value={form.name} maxLength={200} onChange={(e) => set("name", e.target.value)} />}
          </Field>
          <Field label="Phone" optional error={errorFor("phone") ?? (fieldError && !fieldError.field && /phone/i.test(fieldError.message) ? fieldError.message : undefined)}>
            {(id, hint) => (
              <Input id={id} aria-describedby={hint} inputMode="tel" placeholder="01XXXXXXXXX" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            )}
          </Field>
          <Field label="Programme">
            {(id) => (
              <Select id={id} value={form.program} onChange={(e) => set("program", e.target.value as FormState["program"])}>
                {meta.data?.programs.map((p) => <option key={p} value={p}>{p === "Unspecified" ? "To confirm" : p}</option>)}
              </Select>
            )}
          </Field>
          <div className={styles.row}>
            <Field label="Queue">
              {(id) => (
                <Select id={id} value={form.route} onChange={(e) => set("route", e.target.value as FormState["route"])}>
                  {meta.data?.routes.map((r) => <option key={r}>{r}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Language">
              {(id) => (
                <Select id={id} value={form.language} onChange={(e) => set("language", e.target.value as FormState["language"])}>
                  {meta.data?.languages.map((l) => <option key={l}>{l}</option>)}
                </Select>
              )}
            </Field>
          </div>
          <Field label="Team notes" optional>
            {(id) => <Textarea id={id} rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Visible to the team only" />}
          </Field>
        </section>

        {fieldError && !fieldError.field && !/phone/i.test(fieldError.message) && (
          <p className={styles.error} role="alert">
            {fieldError.message}
          </p>
        )}

        {dirty && (
          <footer className={styles.footer}>
            <span className={styles.status}>Unsaved changes</span>
            <Button size="sm" variant="ghost" disabled={update.isPending} onClick={() => setForm(initial)}>
              Discard
            </Button>
            <Button size="sm" variant="primary" type="submit" loading={update.isPending}>
              Save changes
            </Button>
          </footer>
        )}
      </form>
    </Card>
  );
}
