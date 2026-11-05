import { useState, type DragEvent } from "react";
import { Clock, GripVertical, MessagesSquare } from "lucide-react";
import { Avatar, Badge, useToast } from "@/components/ui";
import { useMeta, useUpdateLead } from "@/hooks/queries";
import { useContactSheet } from "@/hooks/useContactSheet";
import { cx } from "@/lib/cx";
import { STAGE_TONE, followUpState, inboundMessages, lastMessage, splitName } from "@/lib/lead";
import type { Lead, Stage } from "@/types";
import { ChannelIcon } from "@/features/leads/LeadBits";
import styles from "./KanbanBoard.module.css";

const DRAG_TYPE = "application/x-biai-lead";

export function KanbanBoard({ leads }: { leads: Lead[] }) {
  const meta = useMeta();
  const update = useUpdateLead();
  const toast = useToast();
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<Stage | null>(null);
  const stages = meta.data?.stages ?? (["New", "Contacted", "Interested", "Paid", "Lost"] as Stage[]);

  function drop(event: DragEvent, stage: Stage) {
    event.preventDefault();
    setOver(null);
    const id = event.dataTransfer.getData(DRAG_TYPE);
    const lead = leads.find((l) => l.id === id);
    if (!lead || lead.status === stage) return;
    update.mutate(
      { id, changes: { status: stage } },
      {
        onSuccess: () => toast.success(`${splitName(lead.name).primary} moved to ${stage}.`),
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <div className={styles.board} role="list" aria-label="Pipeline stages">
      {stages.map((stage) => {
        const items = leads.filter((l) => l.status === stage);
        return (
          <section
            key={stage}
            role="listitem"
            aria-label={`${stage}, ${items.length} contacts`}
            className={cx(styles.column, over === stage && styles.columnOver)}
            onDragOver={(e) => {
              if (!dragging) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (over !== stage) setOver(stage);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null);
            }}
            onDrop={(e) => drop(e, stage)}
          >
            <header className={styles.columnHeader}>
              <Badge tone={STAGE_TONE[stage]} dot variant="soft">
                {stage}
              </Badge>
              <span className={cx(styles.columnCount, "tabular")}>{items.length}</span>
            </header>
            <div className={styles.columnBody}>
              {items.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  dragging={dragging === lead.id}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(DRAG_TYPE, lead.id);
                    e.dataTransfer.effectAllowed = "move";
                    setDragging(lead.id);
                  }}
                  onDragEnd={() => {
                    setDragging(null);
                    setOver(null);
                  }}
                />
              ))}
              {items.length === 0 && (
                <div className={cx(styles.dropHint, dragging && styles.dropHintActive)}>
                  {dragging ? `Drop to move to ${stage}` : "Drag a card here"}
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

interface LeadCardProps {
  lead: Lead;
  dragging: boolean;
  onDragStart: (event: DragEvent) => void;
  onDragEnd: () => void;
}

function LeadCard({ lead, dragging, onDragStart, onDragEnd }: LeadCardProps) {
  const { open } = useContactSheet();
  const message = lastMessage(lead);
  const inbound = inboundMessages(lead);
  const { primary, secondary } = splitName(lead.name);

  return (
    <article
      className={cx(styles.card, dragging && styles.cardDragging, lead.priority === "Urgent" && styles.urgent)}
      draggable
      tabIndex={0}
      aria-label={`${lead.name}, ${lead.status}`}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => open(lead.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open(lead.id);
        }
      }}
    >
      <GripVertical className={styles.grip} aria-hidden />
      <div className={styles.cardHead}>
        <span className={styles.name} title={lead.name}>
          {primary}
        </span>
        {message && <ChannelIcon channel={message.channel} />}
      </div>
      {secondary && <p className={styles.company}>{secondary}</p>}

      {message && <p className={styles.preview}>{message.text}</p>}

      <div className={styles.tags}>
        {lead.priority === "Urgent" && (
          <Badge tone="danger" size="sm">
            Urgent
          </Badge>
        )}
        {lead.program === "Unspecified" ? (
          <Badge tone="warning" size="sm" variant="outline">
            Programme to confirm
          </Badge>
        ) : (
          <Badge tone="neutral" size="sm" variant="outline">
            {lead.program}
          </Badge>
        )}
        {!lead.phone && (
          <Badge tone="warning" size="sm" variant="outline">
            No phone
          </Badge>
        )}
      </div>

      <footer className={styles.cardFoot}>
        <DueLabel lead={lead} />
        <span className={styles.footRight}>
          {inbound.length > 1 && (
            <span className={styles.thread} title={`${inbound.length} messages`}>
              <MessagesSquare />
              {inbound.length}
            </span>
          )}
          {lead.owner ? (
            <span title={`Owner: ${lead.owner}`}>
              <Avatar name={lead.owner} size="xs" />
            </span>
          ) : (
            <span className={styles.unassigned}>Unassigned</span>
          )}
        </span>
      </footer>
    </article>
  );
}

/** Quiet, colour-coded text instead of a pill: readable at a glance without
 *  turning a column of overdue cards into a wall of red. */
function DueLabel({ lead }: { lead: Lead }) {
  const state = followUpState(lead);
  if (state.kind === "none") return <span />;
  const label = state.overdueDays > 0 ? `${state.overdueDays}d overdue` : state.label;
  return (
    <span className={styles.due} data-tone={state.tone} title={state.label}>
      <Clock aria-hidden />
      {label}
    </span>
  );
}
