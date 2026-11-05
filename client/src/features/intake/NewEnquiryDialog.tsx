import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, AlertTriangle, PenLine, Sparkles } from "lucide-react";
import { intakeApi, type SaveIntakeInput } from "@/api/endpoints";
import { Badge, Button, Dialog, Field, Input, Select, Textarea, useToast } from "@/components/ui";
import { useMeta, useReplaceLead } from "@/hooks/queries";
import { useContactSheet } from "@/hooks/useContactSheet";
import type { Analysis, AnalysisMode, Channel, IntakeInput } from "@/types";
import styles from "./NewEnquiryDialog.module.css";

const EMPTY_INPUT: IntakeInput = { message: "", channel: "WhatsApp", name: "", phone: "" };

const MODE_INFO: Record<AnalysisMode, { label: string; tone: "success" | "info" | "warning" | "neutral"; text: string }> = {
  live: { label: "Live AI", tone: "success", text: "Extracted by the configured AI provider. Check every field before saving." },
  sample: { label: "Reviewed sample", tone: "info", text: "A supplied message, so a human-reviewed interpretation is used. No AI call was made." },
  heuristic: { label: "Rule-based", tone: "warning", text: "No AI key is configured, so simple rules were used. Check every field carefully." },
  manual: { label: "Manual entry", tone: "neutral", text: "Fill in the details yourself." },
};

export function NewEnquiryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const meta = useMeta();
  const toast = useToast();
  const replace = useReplaceLead();
  const { open: openContact } = useContactSheet();

  const [step, setStep] = useState<"compose" | "review">("compose");
  const [input, setInput] = useState<IntakeInput>(EMPTY_INPUT);
  const [sampleId, setSampleId] = useState("");
  const [review, setReview] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setStep("compose");
      setInput(EMPTY_INPUT);
      setSampleId("");
      setReview(null);
      setError("");
    }
  }, [open]);

  const sample = useMemo(() => meta.data?.samples.find((s) => s.id === sampleId), [meta.data, sampleId]);

  function pickSample(id: string) {
    setSampleId(id);
    setError("");
    const chosen = meta.data?.samples.find((s) => s.id === id);
    setInput(chosen ? { message: chosen.message, channel: chosen.channel, name: chosen.name, phone: chosen.phone } : EMPTY_INPUT);
  }

  async function extract(event: FormEvent) {
    event.preventDefault();
    if (!input.message.trim()) {
      setError("Paste the enquiry message first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      setReview(await intakeApi.analyze(input));
      setStep("review");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function enterManually() {
    setReview({
      name: input.name,
      phone: input.phone,
      program: "Unspecified",
      route: "Sales",
      language: "English",
      reason: "",
      reply: "",
      mode: "manual",
    });
    setError("");
    setStep("review");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!review) return;
    if (!input.message.trim()) {
      setError("Add the original message so it's kept on the contact.");
      return;
    }
    setBusy(true);
    setError("");
    const payload: SaveIntakeInput = {
      ...input,
      name: review.name.trim() || "Unknown",
      phone: review.phone,
      program: review.program,
      route: review.route,
      language: review.language,
      reply: review.reply,
      reason: review.reason,
      mode: review.mode,
      ...(sample && sample.message === input.message && sample.channel === input.channel ? { sourceId: sample.id } : {}),
    };
    try {
      const result = await intakeApi.save(payload);
      replace(result.lead);
      toast.success(result.created ? "Enquiry saved as a new contact." : "Saved to the existing contact. No message was duplicated.");
      onClose();
      openContact(result.lead.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const setReviewField = <K extends keyof Analysis>(key: K, value: Analysis[K]) =>
    setReview((current) => (current ? { ...current, [key]: value } : current));

  const mode = review ? MODE_INFO[review.mode] : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      title={step === "compose" ? "New enquiry" : "Review and save"}
      description={
        step === "compose"
          ? "Paste a message, or pick one of the 20 supplied samples."
          : "Correct anything that's wrong. The original message is kept as received."
      }
      footer={
        step === "compose" ? (
          <>
            <Button variant="ghost" icon={<PenLine />} onClick={enterManually} className={styles.footerStart}>
              Enter details manually
            </Button>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" type="submit" form="intake-compose" loading={busy} iconRight={<ArrowRight />} icon={busy ? undefined : <Sparkles />}>
              Extract details
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" icon={<ArrowLeft />} onClick={() => setStep("compose")} className={styles.footerStart}>
              Back
            </Button>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" type="submit" form="intake-review" loading={busy}>
              Save enquiry
            </Button>
          </>
        )
      }
    >
      {step === "compose" ? (
        <form id="intake-compose" className={styles.form} onSubmit={extract}>
          <Field label="Supplied sample" optional>
            {(id) => (
              <Select id={id} value={sampleId} onChange={(e) => pickSample(e.target.value)}>
                <option value="">Choose a sample message…</option>
                {meta.data?.samples.map((s) => (
                  <option key={s.id} value={s.id}>
                    #{s.id} · {s.name.split(" (")[0]} · {s.channel}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className={styles.grid3}>
            <Field label="Source">
              {(id) => (
                <Select id={id} value={input.channel} onChange={(e) => setInput({ ...input, channel: e.target.value as Channel })}>
                  {meta.data?.channels.map((c) => <option key={c}>{c}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Sender name" optional>
              {(id) => <Input id={id} value={input.name} maxLength={200} onChange={(e) => setInput({ ...input, name: e.target.value })} />}
            </Field>
            <Field label="Phone" optional>
              {(id) => (
                <Input id={id} inputMode="tel" placeholder="01XXXXXXXXX" value={input.phone} onChange={(e) => setInput({ ...input, phone: e.target.value })} />
              )}
            </Field>
          </div>
          <Field label="Message" error={error || undefined}>
            {(id, hint) => (
              <Textarea
                id={id}
                aria-describedby={hint}
                rows={6}
                maxLength={8000}
                data-autofocus
                placeholder="Paste the enquiry exactly as received…"
                value={input.message}
                onChange={(e) => {
                  setInput({ ...input, message: e.target.value });
                  setError("");
                }}
              />
            )}
          </Field>
        </form>
      ) : review && mode ? (
        <form id="intake-review" className={styles.form} onSubmit={save}>
          <div className={styles.source}>
            <Badge tone={mode.tone} dot>
              {mode.label}
            </Badge>
            <p>{review.reason || mode.text}</p>
          </div>
          {input.message && <blockquote className={styles.quote}>{input.message}</blockquote>}
          <div className={styles.grid2}>
            <Field label="Name">
              {(id) => <Input id={id} value={review.name} maxLength={200} onChange={(e) => setReviewField("name", e.target.value)} />}
            </Field>
            <Field
              label="Phone"
              optional
              hint={
                !review.phone ? (
                  <span className={styles.warn}>
                    <AlertTriangle /> No phone yet. Blank phones never merge contacts.
                  </span>
                ) : undefined
              }
            >
              {(id, hint) => (
                <Input id={id} aria-describedby={hint} inputMode="tel" value={review.phone} onChange={(e) => setReviewField("phone", e.target.value)} />
              )}
            </Field>
          </div>
          <div className={styles.grid3}>
            <Field label="Programme">
              {(id) => (
                <Select id={id} value={review.program} onChange={(e) => setReviewField("program", e.target.value as Analysis["program"])}>
                  {meta.data?.programs.map((p) => <option key={p} value={p}>{p === "Unspecified" ? "To confirm" : p}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Queue">
              {(id) => (
                <Select id={id} value={review.route} onChange={(e) => setReviewField("route", e.target.value as Analysis["route"])}>
                  {meta.data?.routes.map((r) => <option key={r}>{r}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Language">
              {(id) => (
                <Select id={id} value={review.language} onChange={(e) => setReviewField("language", e.target.value as Analysis["language"])}>
                  {meta.data?.languages.map((l) => <option key={l}>{l}</option>)}
                </Select>
              )}
            </Field>
          </div>
          {step === "review" && !input.message && (
            <Field label="Original message">
              {(id) => <Textarea id={id} rows={3} value={input.message} onChange={(e) => setInput({ ...input, message: e.target.value })} />}
            </Field>
          )}
          <Field label="Reply draft" optional hint={review.route === "Spam" ? "Spam never gets a reply." : "Saved with the contact. Nothing is sent."}>
            {(id, hint) => (
              <Textarea
                id={id}
                aria-describedby={hint}
                rows={4}
                value={review.reply}
                disabled={review.route === "Spam"}
                onChange={(e) => setReviewField("reply", e.target.value)}
              />
            )}
          </Field>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </form>
      ) : null}
    </Dialog>
  );
}
