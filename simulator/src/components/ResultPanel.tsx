import { ArrowUpRight, Inbox } from "lucide-react";
import type { InboundResult } from "../lib/api";
import { firstName } from "../lib/channels";
import panel from "./Panel.module.css";
import styles from "./ResultPanel.module.css";

interface ResultPanelProps {
  sending: boolean;
  result: InboundResult | null;
}

/** How the CRM filed the latest message. */
export function ResultPanel({ sending, result }: ResultPanelProps) {
  return (
    <div className={`${panel.column} ${styles.column}`}>
      <section className={panel.card} aria-labelledby="result-title" aria-live="polite">
        <div className={panel.head}>
          <span className="eyebrow">In the CRM</span>
          <h2 id="result-title" className={panel.title}>
            {result && !sending ? (result.created ? "New enquiry created" : "Added to an existing contact") : "Waiting for a message"}
          </h2>
        </div>

        {result && !sending ? (
          <>
            <dl className={styles.facts}>
              <div>
                <dt>Name</dt>
                <dd>{firstName(result.contact.name)}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{result.contact.phone || "—"}</dd>
              </div>
              <div>
                <dt>Programme</dt>
                <dd>{result.contact.program === "Unspecified" ? "To confirm" : result.contact.program}</dd>
              </div>
              <div>
                <dt>Queue</dt>
                <dd>{result.contact.route}</dd>
              </div>
              <div>
                <dt>Language</dt>
                <dd>{result.contact.language}</dd>
              </div>
              <div>
                <dt>Messages</dt>
                <dd>{result.contact.messages}</dd>
              </div>
            </dl>
            <a className={styles.open} href={result.contact.crmUrl} target="_blank" rel="noopener noreferrer">
              View in CRM
              <ArrowUpRight />
            </a>
          </>
        ) : (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>
              <Inbox />
            </span>
            <p>{sending ? "Filing your message…" : "Send a message to see how the admissions team receives it."}</p>
          </div>
        )}
      </section>
    </div>
  );
}
