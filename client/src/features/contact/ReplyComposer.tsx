import { useEffect, useState } from "react";
import { CheckCheck, Copy, MessageCircle, Save, Sparkles } from "lucide-react";
import { leadsApi } from "@/api/endpoints";
import { Badge, Button, Card, CardHeader, Textarea, buttonClass, useToast } from "@/components/ui";
import { useReplaceLead } from "@/hooks/queries";
import { DRAFT_LABEL, whatsappUrl } from "@/lib/lead";
import type { Lead } from "@/types";
import styles from "./ReplyComposer.module.css";

export function ReplyComposer({ lead }: { lead: Lead }) {
  const replace = useReplaceLead();
  const toast = useToast();
  const [text, setText] = useState(lead.draft);
  const [busy, setBusy] = useState<"draft" | "save" | "sent" | null>(null);

  useEffect(() => setText(lead.draft), [lead.draft]);

  const dirty = text !== lead.draft;
  const wa = whatsappUrl(lead.phone, text);

  async function generate() {
    if (dirty && !window.confirm("Replace your edited reply with a new draft?")) return;
    setBusy("draft");
    try {
      replace(await leadsApi.draftReply(lead.id));
      toast.success("New reply drafted. Review it before sending.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    setBusy("save");
    try {
      replace(await leadsApi.update(lead.id, { draft: text }));
      toast.success("Reply saved.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  /** Record the reply (as edited) as sent: it joins the conversation and counts as contact. */
  async function markSent() {
    setBusy("sent");
    try {
      replace(await leadsApi.recordReply(lead.id, text));
      toast.success("Reply added to the conversation and logged as contact.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Reply copied. Copying doesn't log a contact.");
    } catch {
      toast.error("Couldn't copy. Select the text and copy it manually.");
    }
  }

  return (
    <Card>
      <CardHeader
        title="Reply"
        description={`Draft in ${lead.language}. Send it from WhatsApp or by phone, then mark it as sent.`}
        action={
          <Badge tone={lead.draftMode === "live" ? "success" : lead.draftMode === "human-reviewed" ? "info" : "neutral"} variant="outline">
            {DRAFT_LABEL[lead.draftMode] ?? lead.draftMode}
          </Badge>
        }
      />
      <Textarea
        aria-label="Reply draft"
        rows={4}
        value={text}
        placeholder="No reply drafted yet."
        onChange={(e) => setText(e.target.value)}
        lang={lead.language === "Bangla" ? "bn" : undefined}
        className={styles.textarea}
      />
      <div className={styles.actions}>
        <Button variant="ghost" size="sm" icon={<Sparkles />} loading={busy === "draft"} onClick={generate}>
          Draft new reply
        </Button>
        <span className={styles.spacer} />
        <Button size="sm" icon={<Copy />} onClick={copy} disabled={!text}>
          Copy
        </Button>
        {wa && text && (
          <a className={buttonClass("whatsapp", "sm")} href={wa} target="_blank" rel="noopener noreferrer">
            <MessageCircle />
            <span>Open in WhatsApp</span>
          </a>
        )}
        <Button size="sm" icon={<Save />} disabled={!dirty} loading={busy === "save"} onClick={save}>
          Save draft
        </Button>
        <Button
          size="sm"
          variant="primary"
          icon={<CheckCheck />}
          disabled={!text.trim() || lead.route === "Spam"}
          loading={busy === "sent"}
          onClick={markSent}
        >
          Mark as sent
        </Button>
      </div>
      <p className={styles.hint}>
        Replies never promise prices, dates, venues, refunds or payment confirmation. The team confirms those.
      </p>
    </Card>
  );
}
