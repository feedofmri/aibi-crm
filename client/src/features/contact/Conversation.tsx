import { Card, CardHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import type { Lead } from "@/types";
import { ChannelIcon } from "@/features/leads/LeadBits";
import styles from "./Conversation.module.css";

/** The original messages, exactly as received. */
export function Conversation({ lead }: { lead: Lead }) {
  return (
    <Card>
      <CardHeader
        title="Conversation"
        description={`${lead.messages.length} original message${lead.messages.length === 1 ? "" : "s"}, kept exactly as received`}
      />
      <ol className={styles.thread}>
        {lead.messages.map((message) => (
          <li key={message.id} className={styles.message}>
            <div className={styles.meta}>
              <ChannelIcon channel={message.channel} />
              <span>{message.channel}</span>
              <span className={styles.dot}>·</span>
              <time dateTime={message.receivedAt}>{formatDateTime(message.receivedAt)}</time>
            </div>
            <p className={styles.bubble} lang={lead.language === "Bangla" ? "bn" : undefined}>
              {message.text}
            </p>
          </li>
        ))}
      </ol>
      {lead.analysisReason && (
        <p className={styles.note}>
          <span>Intake note</span>
          {lead.analysisReason}
        </p>
      )}
    </Card>
  );
}
