import type { ReactNode } from "react";
import { MessageCircle } from "lucide-react";
import { formatDateTime, formatRelative } from "@/lib/format";
import { lastMessage, whatsappUrl } from "@/lib/lead";
import { useContactSheet } from "@/hooks/useContactSheet";
import type { Lead } from "@/types";
import { ChannelIcon, ContactCell, FollowUpBadge, ProgrammeLabel, QueueBadge, StageBadge } from "./LeadBits";
import styles from "./LeadTable.module.css";

interface LeadTableProps {
  leads: Lead[];
  showQueue?: boolean;
  /** Extra per-row action rendered before the WhatsApp button (e.g. "Log contact"). */
  rowAction?: (lead: Lead) => ReactNode;
  caption: string;
}

/** Contacts table. The whole row opens the contact; inner buttons don't. */
export function LeadTable({ leads, showQueue = true, rowAction, caption }: LeadTableProps) {
  const { open } = useContactSheet();

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <caption className="visually-hidden">{caption}</caption>
        {/* Fixed column widths keep separate tables (e.g. follow-up groups) aligned. */}
        <colgroup>
          <col style={{ width: showQueue ? "27%" : "31%" }} />
          {showQueue && <col style={{ width: "9%" }} />}
          <col style={{ width: "14%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "16%" }} />
          <col style={{ width: rowAction ? 200 : 64 }} />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Contact</th>
            {showQueue && <th scope="col">Queue</th>}
            <th scope="col">Programme</th>
            <th scope="col">Stage</th>
            <th scope="col">Last message</th>
            <th scope="col">Follow-up · owner</th>
            <th scope="col">
              <span className="visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => {
            const message = lastMessage(lead);
            const wa = whatsappUrl(lead.phone, lead.draft);
            return (
              <tr
                key={lead.id}
                className={styles.row}
                tabIndex={0}
                aria-label={`Open ${lead.name}`}
                onClick={() => open(lead.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.target === e.currentTarget) open(lead.id);
                }}
              >
                <td className={styles.contactCol}>
                  <ContactCell lead={lead} />
                </td>
                {showQueue && (
                  <td>
                    <QueueBadge lead={lead} />
                  </td>
                )}
                <td className={styles.secondary}>
                  <ProgrammeLabel lead={lead} />
                </td>
                <td>
                  <StageBadge lead={lead} />
                </td>
                <td>
                  {message && (
                    <span className={styles.message}>
                      <ChannelIcon channel={message.channel} />
                      <span title={formatDateTime(message.receivedAt)}>{formatRelative(message.receivedAt)}</span>
                      {lead.messages.length > 1 && <span className={styles.thread}>· {lead.messages.length} msgs</span>}
                    </span>
                  )}
                </td>
                <td>
                  <span className={styles.stack}>
                    <FollowUpBadge lead={lead} />
                    <span className={lead.owner ? styles.owner : styles.unassigned}>{lead.owner || "Unassigned"}</span>
                  </span>
                </td>
                <td className={styles.actionsCol} onClick={(e) => e.stopPropagation()}>
                  <span className={styles.actions}>
                    {rowAction?.(lead)}
                    {wa ? (
                      <a className={styles.wa} href={wa} target="_blank" rel="noopener noreferrer" title="Open WhatsApp chat" aria-label={`WhatsApp ${lead.name}`}>
                        <MessageCircle />
                      </a>
                    ) : (
                      <span className={styles.waPlaceholder} title="No phone number" aria-hidden />
                    )}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
