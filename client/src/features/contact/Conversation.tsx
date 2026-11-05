import { Bot, UserRound } from "lucide-react";
import { Card, CardHeader } from "@/components/ui";
import { cx } from "@/lib/cx";
import { formatDateTime } from "@/lib/format";
import { inboundMessages } from "@/lib/lead";
import type { Lead } from "@/types";
import { ChannelIcon } from "@/features/leads/LeadBits";
import styles from "./Conversation.module.css";

/** The thread: customer messages exactly as received, and the replies BIAI sent. */
export function Conversation({ lead }: { lead: Lead }) {
  const received = inboundMessages(lead).length;
  const sent = lead.messages.length - received;
  const description = [
    `${received} message${received === 1 ? "" : "s"} received`,
    sent ? `${sent} repl${sent === 1 ? "y" : "ies"} sent` : "no reply sent yet",
  ].join(" · ");

  return (
    <Card>
      <CardHeader title="Conversation" description={description} />
      <ol className={styles.thread}>
        {lead.messages.map((message) => {
          const outbound = message.direction === "outbound";
          return (
            <li key={message.id} className={cx(styles.message, outbound && styles.outbound)}>
              <div className={styles.meta}>
                {outbound ? (
                  <>
                    {message.delivery === "auto" ? <Bot aria-hidden /> : <UserRound aria-hidden />}
                    <span>{message.delivery === "auto" ? "Auto-reply" : `Sent by ${message.author || "the team"}`}</span>
                  </>
                ) : (
                  <>
                    <ChannelIcon channel={message.channel} />
                    <span>{message.channel}</span>
                  </>
                )}
                <span className={styles.dot}>·</span>
                <time dateTime={message.receivedAt}>{formatDateTime(message.receivedAt)}</time>
              </div>
              <p className={cx(styles.bubble, outbound && styles.bubbleOut)} lang={lead.language === "Bangla" ? "bn" : undefined}>
                {message.text}
              </p>
            </li>
          );
        })}
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
