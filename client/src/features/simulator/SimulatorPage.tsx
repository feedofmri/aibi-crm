import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { CheckCircle2, Circle, ExternalLink, Loader2, RotateCcw, SendHorizontal } from "lucide-react";
import { simulatorApi } from "@/api/endpoints";
import icon from "@/assets/brand/biai-icon.png";
import { Badge, Button, Card, CardHeader, Field, Input, useToast } from "@/components/ui";
import { PageHeader } from "@/components/layout/PageHeader";
import { useMeta, useReplaceLead } from "@/hooks/queries";
import { useContactSheet } from "@/hooks/useContactSheet";
import { cx } from "@/lib/cx";
import { QUEUE_TONE, splitName } from "@/lib/lead";
import type { Analysis, Channel, Lead } from "@/types";
import { ChannelIcon } from "@/features/leads/LeadBits";
import styles from "./SimulatorPage.module.css";

interface ChatMessage {
  id: number;
  from: "prospect" | "draft";
  text: string;
  at: Date;
}

interface Result {
  lead: Lead;
  created: boolean;
  analysis: Analysis;
}

const CHANNEL_KEY: Record<Channel, string> = {
  WhatsApp: "whatsapp",
  "Facebook Messenger": "messenger",
  "Facebook comment": "comment",
  "Website form": "web",
  "Phone call note": "phone",
};

const MODE_LABEL: Record<string, string> = {
  live: "Live AI",
  sample: "Reviewed sample",
  heuristic: "Rule-based",
  manual: "Manual",
};

const time = (date: Date) =>
  date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" });

export function SimulatorPage() {
  const meta = useMeta();
  const toast = useToast();
  const replace = useReplaceLead();
  const { open } = useContactSheet();

  const [channel, setChannel] = useState<Channel>("WhatsApp");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [text, setText] = useState("");
  const [showDraft, setShowDraft] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const nextId = useRef(1);
  const scroller = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    const el = composer.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);

  function loadSample(id: string) {
    const sample = meta.data?.samples.find((s) => s.id === id);
    if (!sample) return;
    setChannel(sample.channel);
    setName(sample.name);
    setPhone(sample.phone);
    setText(sample.message);
    composer.current?.focus();
  }

  function reset() {
    setMessages([]);
    setResult(null);
    setText("");
  }

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const message = text.trim();
    if (!message || sending) return;
    const sentAt = new Date();
    setMessages((all) => [...all, { id: nextId.current++, from: "prospect", text: message, at: sentAt }]);
    setText("");
    setSending(true);
    setResult(null);
    try {
      const response = await simulatorApi.send({ message, channel, name, phone });
      replace(response.lead);
      setResult(response);
      if (showDraft && response.analysis.reply) {
        setMessages((all) => [...all, { id: nextId.current++, from: "draft", text: response.analysis.reply, at: new Date() }]);
      }
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSending(false);
    }
  }

  function onComposerKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  const channelKey = CHANNEL_KEY[channel];

  return (
    <>
      <PageHeader
        title="Channel simulator"
        description="Send a test message as if a prospect wrote in. It's processed and saved exactly like a real enquiry. No real channel is connected and nothing is sent."
      />

      <div className={styles.layout}>
        {/* Sender setup */}
        <div className={styles.column}>
          <Card>
            <CardHeader title="Sender" />
            <div className={styles.channels} role="radiogroup" aria-label="Channel">
              {meta.data?.channels.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={channel === c}
                  className={cx(styles.channel, channel === c && styles.channelSelected)}
                  onClick={() => setChannel(c)}
                >
                  <ChannelIcon channel={c} />
                  <span>{c.replace("Facebook ", "FB ")}</span>
                </button>
              ))}
            </div>
            <div className={styles.senderFields}>
              <Field label="Name" optional>
                {(id) => <Input id={id} value={name} placeholder="e.g. Nadia Islam" onChange={(e) => setName(e.target.value)} />}
              </Field>
              <Field label="Phone" optional>
                {(id) => <Input id={id} inputMode="tel" value={phone} placeholder="01XXXXXXXXX" onChange={(e) => setPhone(e.target.value)} />}
              </Field>
            </div>
            <label className={styles.toggle}>
              <input type="checkbox" checked={showDraft} onChange={(e) => setShowDraft(e.target.checked)} />
              <span>Show the drafted reply in the chat</span>
            </label>
          </Card>

          <Card padded={false} className={styles.samplesCard}>
            <div className={styles.samplesHead}>
              <CardHeader title="Supplied messages" description="Load one into the composer" />
            </div>
            <ul className={styles.samples}>
              {meta.data?.samples.map((sample) => (
                <li key={sample.id}>
                  <button type="button" className={styles.sample} onClick={() => loadSample(sample.id)}>
                    <ChannelIcon channel={sample.channel} />
                    <span className={styles.sampleText}>
                      <strong>{splitName(sample.name).primary}</strong>
                      <span>{sample.message}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Chat */}
        <section className={styles.chat} data-channel={channelKey} aria-label={`${channel} conversation`}>
          <header className={styles.chatHeader}>
            <img src={icon} alt="" className={styles.chatAvatar} />
            <div className={styles.chatTitle}>
              <strong>BIAI Admissions</strong>
              <span>
                <ChannelIcon channel={channel} className={styles.chatChannelIcon} />
                Simulated {channel}
              </span>
            </div>
            {messages.length > 0 && (
              <button type="button" className={styles.chatReset} onClick={reset}>
                <RotateCcw />
                Clear
              </button>
            )}
          </header>

          <div ref={scroller} className={styles.chatBody}>
            {messages.length === 0 ? (
              <div className={styles.chatEmpty}>
                <p className={styles.chatEmptyTitle}>Start a conversation</p>
                <p>Type a message in Bangla, Banglish or English, or load one of the supplied messages.</p>
              </div>
            ) : (
              <>
                <p className={styles.dayDivider}>Today</p>
                {messages.map((m) => (
                  <div key={m.id} className={cx(styles.row, m.from === "prospect" ? styles.rowOut : styles.rowIn)}>
                    <div className={cx(styles.bubble, m.from === "prospect" ? styles.bubbleOut : styles.bubbleIn)}>
                      {m.from === "draft" && <span className={styles.draftLabel}>Suggested reply · draft, not sent</span>}
                      <p>{m.text}</p>
                      <time className={styles.bubbleTime}>{time(m.at)}</time>
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className={cx(styles.row, styles.rowIn)}>
                    <div className={cx(styles.bubble, styles.bubbleIn, styles.typing)} aria-label="Processing">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <form className={styles.composer} onSubmit={send}>
            <textarea
              ref={composer}
              rows={1}
              value={text}
              maxLength={8000}
              placeholder="Type a message…"
              aria-label="Message"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onComposerKey}
            />
            <button type="submit" className={styles.send} disabled={!text.trim() || sending} aria-label="Send message">
              {sending ? <Loader2 className={styles.spin} /> : <SendHorizontal />}
            </button>
          </form>
        </section>

        {/* What happened */}
        <div className={styles.column}>
          <Card>
            <CardHeader title="What happens on send" />
            <ol className={styles.steps}>
              {[
                { title: "Message received", text: `Via simulated ${channel}` },
                { title: "Details extracted", text: meta.data?.ai.mode === "live" ? `Live AI (${meta.data.ai.provider})` : "Rule-based (no AI key)" },
                { title: "Saved to the CRM", text: "Same phone joins the existing contact" },
              ].map((s, index) => {
                const state = result ? "done" : sending ? (index === 0 ? "done" : index === 1 ? "active" : "idle") : "idle";
                return (
                  <li key={s.title} className={cx(styles.step, styles[state])}>
                    {state === "done" ? <CheckCircle2 /> : state === "active" ? <Loader2 className={styles.spin} /> : <Circle />}
                    <span>
                      <strong>{s.title}</strong>
                      <span>{s.text}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </Card>

          {result && (
            <Card>
              <CardHeader
                title={result.created ? "New contact created" : "Added to existing contact"}
                action={<Badge tone="neutral" variant="outline">{MODE_LABEL[result.analysis.mode] ?? result.analysis.mode}</Badge>}
              />
              <dl className={styles.facts}>
                <div><dt>Name</dt><dd>{splitName(result.lead.name).primary}</dd></div>
                <div><dt>Phone</dt><dd>{result.lead.phone || <span className={styles.missing}>Not provided</span>}</dd></div>
                <div><dt>Programme</dt><dd>{result.lead.program === "Unspecified" ? "To confirm" : result.lead.program}</dd></div>
                <div><dt>Queue</dt><dd><Badge tone={QUEUE_TONE[result.lead.route]} size="sm">{result.lead.route}</Badge></dd></div>
                <div><dt>Language</dt><dd>{result.lead.language}</dd></div>
              </dl>
              <Button block icon={<ExternalLink />} onClick={() => open(result.lead.id)}>
                Open contact
              </Button>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
