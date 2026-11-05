import { Clock, Facebook, Globe, MessageCircle, MessageSquare, Phone } from "lucide-react";
import { Avatar, Badge } from "@/components/ui";
import { cx } from "@/lib/cx";
import { QUEUE_TONE, STAGE_TONE, followUpState, splitName } from "@/lib/lead";
import type { Channel, Lead } from "@/types";
import styles from "./LeadBits.module.css";

const CHANNEL_ICON: Record<Channel, typeof Phone> = {
  WhatsApp: MessageCircle,
  "Facebook Messenger": MessageSquare,
  "Facebook comment": Facebook,
  "Website form": Globe,
  "Phone call note": Phone,
};

export function ChannelIcon({ channel, className }: { channel: Channel; className?: string }) {
  const Icon = CHANNEL_ICON[channel] ?? MessageSquare;
  return <Icon className={cx(styles.channelIcon, className)} aria-label={channel} />;
}

export function StageBadge({ lead }: { lead: Lead }) {
  if (lead.route === "Support")
    return (
      <Badge tone={lead.supportStatus === "Resolved" ? "success" : "danger"} dot>
        {lead.supportStatus === "Resolved" ? "Resolved" : "Open case"}
      </Badge>
    );
  if (lead.route !== "Sales") return <Badge tone="neutral">Not in pipeline</Badge>;
  return (
    <Badge tone={STAGE_TONE[lead.status]} dot>
      {lead.status}
    </Badge>
  );
}

export function QueueBadge({ lead, size = "md" }: { lead: Lead; size?: "sm" | "md" }) {
  return (
    <Badge tone={QUEUE_TONE[lead.route]} variant="outline" size={size}>
      {lead.route}
    </Badge>
  );
}

export function FollowUpBadge({ lead, size = "md" }: { lead: Lead; size?: "sm" | "md" }) {
  const state = followUpState(lead);
  if (state.kind === "none") return <span className={styles.muted}>—</span>;
  return (
    <Badge tone={state.tone} size={size} icon={<Clock />}>
      {state.label}
    </Badge>
  );
}

/** Avatar + name (+ role/company on a second line) + phone. */
export function ContactCell({ lead, showPhone = true }: { lead: Lead; showPhone?: boolean }) {
  const { primary, secondary } = splitName(lead.name);
  return (
    <span className={styles.contact}>
      <Avatar name={lead.name} size="md" />
      <span className={styles.contactText}>
        <span className={styles.contactName}>
          {primary}
          {lead.priority === "Urgent" && (
            <Badge tone="danger" size="sm">
              Urgent
            </Badge>
          )}
        </span>
        <span className={styles.contactMeta}>
          {secondary || (showPhone ? lead.phone || <span className={styles.missing}>No phone number</span> : null)}
        </span>
      </span>
    </span>
  );
}

export function ProgrammeLabel({ lead }: { lead: Lead }) {
  if (lead.route !== "Sales") return <span className={styles.muted}>—</span>;
  if (lead.program === "Unspecified") return <span className={styles.unclear}>To confirm</span>;
  return <span>{lead.program}</span>;
}
