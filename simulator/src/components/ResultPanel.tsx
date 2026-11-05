import { CheckCircle2, Circle, ExternalLink, Loader2 } from "lucide-react";
import type { Channel, ChannelInfo, InboundResult } from "../lib/api";
import { firstName } from "../lib/channels";
import panel from "./Panel.module.css";
import styles from "./ResultPanel.module.css";

const MODE_LABEL: Record<string, string> = {
  live: "Live AI",
  sample: "Reviewed sample",
  heuristic: "Rule-based",
  manual: "Manual",
};

const QUEUE_TONE: Record<string, string> = { Sales: "brand", Support: "danger", Careers: "violet", Spam: "neutral" };

interface ResultPanelProps {
  channel: Channel;
  info: ChannelInfo | null;
  sending: boolean;
  result: InboundResult | null;
}

export function ResultPanel({ channel, info, sending, result }: ResultPanelProps) {
  const steps = [
    { title: "Received by the CRM", text: `Inbound ${channel} message, authenticated with the channel key` },
    {
      title: "Details extracted",
      text: info?.ai.mode === "live" ? `Live AI (${info.ai.provider}) with a strict schema` : "Rule-based extraction (no AI key)",
    },
    { title: "Saved as an enquiry", text: "A matching phone joins the existing contact" },
  ];

  return (
    <div className={`${panel.column} ${styles.column}`}>
      <section className={panel.card} aria-labelledby="flow-title">
        <div className={panel.head}>
          <h2 id="flow-title" className={panel.title}>
            Inside the CRM
          </h2>
          <p className={panel.subtitle}>What happens when you press send.</p>
        </div>
        <ol className={styles.steps}>
          {steps.map((step, index) => {
            const state = result && !sending ? "done" : sending ? (index === 0 ? "done" : index === 1 ? "active" : "idle") : "idle";
            return (
              <li key={step.title} className={styles.step} data-state={state}>
                {state === "done" ? <CheckCircle2 /> : state === "active" ? <Loader2 className={styles.spin} /> : <Circle />}
                <span>
                  <strong>{step.title}</strong>
                  <span>{step.text}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      {result && !sending && (
        <section className={panel.card} aria-labelledby="result-title" aria-live="polite">
          <div className={styles.resultHead}>
            <h2 id="result-title" className={panel.title}>
              {result.created ? "New contact created" : "Added to an existing contact"}
            </h2>
            <span className={styles.mode}>{MODE_LABEL[result.analysis.mode] ?? result.analysis.mode}</span>
          </div>
          <dl className={styles.facts}>
            <div>
              <dt>Name</dt>
              <dd>{firstName(result.contact.name)}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{result.contact.phone || <span className={styles.missing}>Not provided</span>}</dd>
            </div>
            <div>
              <dt>Programme</dt>
              <dd>{result.contact.program === "Unspecified" ? "To confirm" : result.contact.program}</dd>
            </div>
            <div>
              <dt>Queue</dt>
              <dd>
                <span className={styles.queue} data-tone={QUEUE_TONE[result.contact.route]}>
                  {result.contact.route}
                </span>
              </dd>
            </div>
            <div>
              <dt>Language</dt>
              <dd>{result.contact.language}</dd>
            </div>
            <div>
              <dt>Messages on contact</dt>
              <dd>{result.contact.messages}</dd>
            </div>
          </dl>
          <a className={styles.open} href={result.contact.crmUrl} target="_blank" rel="noopener noreferrer">
            Open in the CRM <ExternalLink />
          </a>
          <p className={styles.hint}>Opens the CRM in a new tab. Staff sign-in is required.</p>
        </section>
      )}
    </div>
  );
}
