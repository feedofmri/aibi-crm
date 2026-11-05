import { useEffect, useRef, type FormEvent, type KeyboardEvent } from "react";
import { Loader2, RotateCcw, SendHorizontal } from "lucide-react";
import icon from "../assets/biai-icon.png";
import type { Channel } from "../lib/api";
import { CHANNEL_META } from "../lib/channels";
import styles from "./ChatWindow.module.css";

export interface ChatMessage {
  id: number;
  from: "customer" | "draft";
  text: string;
  at: Date;
}

interface ChatWindowProps {
  channel: Channel;
  senderName: string;
  messages: ChatMessage[];
  draft: string;
  sending: boolean;
  disabled: boolean;
  error: string;
  onDraft: (value: string) => void;
  onSend: () => void;
  onClear: () => void;
}

const time = (date: Date) => date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" });

/**
 * A messaging window seen from the customer's side: one rounded frame whose
 * header and composer are clipped by the same corners.
 */
export function ChatWindow({ channel, senderName, messages, draft, sending, disabled, error, onDraft, onSend, onClear }: ChatWindowProps) {
  const meta = CHANNEL_META[channel];
  const Icon = meta.icon;
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
  }, [draft]);

  function submit(event: FormEvent) {
    event.preventDefault();
    onSend();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  }

  return (
    <section className={styles.chat} data-channel={meta.key} aria-label={`${channel} conversation`}>
      <header className={styles.header}>
        <img src={icon} alt="" className={styles.avatar} />
        <div className={styles.title}>
          <strong>BIAI Admissions</strong>
          <span>
            <Icon />
            {meta.subtitle}
          </span>
        </div>
        {messages.length > 0 && (
          <button type="button" className={styles.reset} onClick={onClear}>
            <RotateCcw />
            New chat
          </button>
        )}
      </header>

      <div ref={scroller} className={styles.body}>
        {messages.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>
              <Icon />
            </span>
            <p className={styles.emptyTitle}>Start a {meta.short} conversation</p>
            <p>
              Write {senderName ? `as ${senderName.replace(/\s*\(.*\)$/, "")}` : "as a prospective student"} in Bangla, Banglish or
              English, or load one of the supplied messages.
            </p>
          </div>
        ) : (
          <>
            <p className={styles.day}>Today</p>
            {messages.map((m) => (
              <div key={m.id} className={styles.row} data-from={m.from}>
                <div className={styles.bubble} data-from={m.from}>
                  {m.from === "draft" && <span className={styles.draftLabel}>CRM draft reply · not sent</span>}
                  <p>{m.text}</p>
                  <time className={styles.time}>{time(m.at)}</time>
                </div>
              </div>
            ))}
            {sending && (
              <div className={styles.row} data-from="draft">
                <div className={`${styles.bubble} ${styles.typing}`} data-from="draft" aria-label="CRM is processing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <form className={styles.composer} onSubmit={submit}>
        <textarea
          ref={composer}
          rows={1}
          value={draft}
          maxLength={8000}
          disabled={disabled}
          placeholder={disabled ? "Waiting for the CRM connection…" : "Type a message…"}
          aria-label="Message"
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button type="submit" className={styles.send} disabled={disabled || sending || !draft.trim()} aria-label="Send message">
          {sending ? <Loader2 className={styles.spin} /> : <SendHorizontal />}
        </button>
      </form>
    </section>
  );
}
