import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowUpRight, RefreshCw } from "lucide-react";
import icon from "./assets/biai-icon.png";
import wordmark from "./assets/biai-logo.png";
import { ChatWindow, type ChatMessage } from "./components/ChatWindow";
import { ResultPanel } from "./components/ResultPanel";
import { SenderPanel } from "./components/SenderPanel";
import { ApiError, channelApi, type Channel, type ChannelInfo, type InboundResult } from "./lib/api";
import styles from "./App.module.css";

type Connection = { state: "loading" } | { state: "ready"; info: ChannelInfo } | { state: "error"; message: string };

export function App() {
  const [connection, setConnection] = useState<Connection>({ state: "loading" });
  const [channel, setChannel] = useState<Channel>("WhatsApp");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [draft, setDraft] = useState("");
  const [showReply, setShowReply] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<InboundResult | null>(null);
  const nextId = useRef(1);

  const connect = useCallback(async () => {
    setConnection({ state: "loading" });
    try {
      setConnection({ state: "ready", info: await channelApi.info() });
    } catch (err) {
      setConnection({ state: "error", message: (err as Error).message });
    }
  }, []);

  useEffect(() => {
    void connect();
  }, [connect]);

  const info = connection.state === "ready" ? connection.info : null;

  function loadSample(id: string) {
    const sample = info?.samples.find((s) => s.id === id);
    if (!sample) return;
    setChannel(sample.channel);
    setName(sample.name);
    setPhone(sample.phone);
    setDraft(sample.message);
  }

  function changeChannel(next: Channel) {
    if (next === channel) return;
    setChannel(next);
    setMessages([]);
    setResult(null);
  }

  function clear() {
    setMessages([]);
    setResult(null);
    setError("");
  }

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setMessages((all) => [...all, { id: nextId.current++, from: "customer", text, at: new Date() }]);
    setDraft("");
    setSending(true);
    setError("");
    try {
      const response = await channelApi.send({ message: text, channel, name, phone });
      setResult(response);
      const { reply } = response;
      if (reply.status === "sent")
        setMessages((all) => [...all, { id: nextId.current++, from: "agent", text: reply.text, at: new Date() }]);
      else if (showReply && reply.text)
        setMessages((all) => [
          ...all,
          { id: nextId.current++, from: "draft", text: reply.text, at: new Date(), note: reply.reason },
        ]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={styles.app}>
      <header className={styles.topbar}>
        <a className={styles.brand} href="/" aria-label="BIAI channel simulator">
          <img src={icon} alt="" width={28} height={28} />
          <img className={styles.wordmark} src={wordmark} alt="BIAI" height={12} />
          <span className={styles.divider} aria-hidden />
          <span className={styles.product}>Simulator</span>
        </a>
        {info && (
          <a className={styles.crmLink} href={info.crmUrl} target="_blank" rel="noopener noreferrer">
            Open CRM
            <ArrowUpRight />
          </a>
        )}
      </header>

      {connection.state === "error" && (
        <div className={styles.banner} role="alert">
          <AlertCircle />
          <span>{connection.message}</span>
          <button type="button" onClick={connect}>
            <RefreshCw /> Retry
          </button>
        </div>
      )}

      <main className={styles.main}>
        <section className={styles.intro}>
          <h1>Write in like a prospective student.</h1>
          <p>Send a message on any channel and watch it arrive in the admissions CRM, ready for the team to reply.</p>
        </section>

        <div className={styles.layout}>
          <SenderPanel
            channels={info?.channels ?? []}
            samples={info?.samples ?? []}
            channel={channel}
            name={name}
            phone={phone}
            showReply={showReply}
            onChannel={changeChannel}
            onName={setName}
            onPhone={setPhone}
            onShowReply={setShowReply}
            onSample={loadSample}
          />
          <ChatWindow
            channel={channel}
            messages={messages}
            draft={draft}
            sending={sending}
            disabled={connection.state !== "ready"}
            error={error}
            onDraft={setDraft}
            onSend={send}
            onClear={clear}
          />
          <ResultPanel sending={sending} result={result} />
        </div>
      </main>

      <footer className={styles.footer}>
        <span>BIAI Admissions · Simulator</span>
        <span>Messages stay inside the CRM. Nothing is sent to WhatsApp or Facebook.</span>
      </footer>
    </div>
  );
}
