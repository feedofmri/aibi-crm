import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, ExternalLink, RefreshCw } from "lucide-react";
import icon from "./assets/biai-icon.png";
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
      if (showReply && response.reply)
        setMessages((all) => [...all, { id: nextId.current++, from: "draft", text: response.reply, at: new Date() }]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={styles.app}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <img src={icon} alt="" width={30} height={30} />
          <div>
            <strong>Channel Simulator</strong>
            <span>BIAI Admissions</span>
          </div>
        </div>
        <span className={styles.envBadge}>Test environment · nothing is sent to anyone</span>
        <div className={styles.topRight}>
          <span className={styles.status} data-state={connection.state}>
            <span className={styles.statusDot} />
            {connection.state === "ready"
              ? `Connected to CRM · ${info?.ai.mode === "live" ? `live AI (${info.ai.provider})` : "rule-based AI"}`
              : connection.state === "loading"
                ? "Connecting…"
                : "Not connected"}
          </span>
          {info && (
            <a className={styles.crmLink} href={info.crmUrl} target="_blank" rel="noopener noreferrer">
              Open CRM <ExternalLink />
            </a>
          )}
        </div>
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
        <div className={styles.intro}>
          <h1>Write in as a prospective student</h1>
          <p>
            Pick a channel and send a message. The CRM receives it through its inbound channel API, extracts the details,
            routes it and saves it, exactly as it would a real enquiry. Open the CRM to see it arrive.
          </p>
        </div>

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
            senderName={name}
            messages={messages}
            draft={draft}
            sending={sending}
            disabled={connection.state !== "ready"}
            error={error}
            onDraft={setDraft}
            onSend={send}
            onClear={clear}
          />
          <ResultPanel channel={channel} info={info} sending={sending} result={result} />
        </div>
      </main>

      <footer className={styles.footer}>
        Fictional sample data only · Messages go to the BIAI CRM&apos;s inbound channel API with a channel key · No WhatsApp or
        Facebook account is connected
      </footer>
    </div>
  );
}
