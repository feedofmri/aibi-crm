import { Check, MoreHorizontal, Phone, Trash2, X, MessageCircle, AlertTriangle, ShieldAlert } from "lucide-react";
import { leadsApi } from "@/api/endpoints";
import { Avatar, Badge, Button, EmptyState, IconButton, Menu, Sheet, buttonClass, useToast } from "@/components/ui";
import { useCurrentUser } from "@/features/auth/AuthProvider";
import { useLead, useReplaceLead } from "@/hooks/queries";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/queries";
import { splitName, whatsappUrl } from "@/lib/lead";
import { useState } from "react";
import type { Lead } from "@/types";
import { FollowUpBadge, QueueBadge, StageBadge } from "@/features/leads/LeadBits";
import { ActivityLog } from "./ActivityLog";
import { Conversation } from "./Conversation";
import { DetailsForm } from "./DetailsForm";
import { ReplyComposer } from "./ReplyComposer";
import styles from "./ContactSheet.module.css";

export function ContactSheet({ contactId, onClose }: { contactId: string | null; onClose: () => void }) {
  const { data: lead, isPending } = useLead(contactId);
  return (
    <Sheet open={Boolean(contactId)} onClose={onClose} label={lead ? `Contact: ${lead.name}` : "Contact"}>
      {lead ? (
        <ContactView key={lead.id} lead={lead} onClose={onClose} />
      ) : (
        <div className={styles.missing}>
          <div className={styles.missingBar}>
            <IconButton label="Close" onClick={onClose}>
              <X />
            </IconButton>
          </div>
          {!isPending && <EmptyState title="Contact not found" description="It may have been deleted." />}
        </div>
      )}
    </Sheet>
  );
}

function ContactView({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const user = useCurrentUser();
  const replace = useReplaceLead();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [logging, setLogging] = useState(false);
  const { primary, secondary } = splitName(lead.name);
  const wa = whatsappUrl(lead.phone, lead.draft);

  async function logContact() {
    setLogging(true);
    try {
      replace(await leadsApi.logContact(lead.id));
      toast.success("Contact logged. The next follow-up is due in 48 hours.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLogging(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete ${lead.name} and all their messages? This can't be undone.`)) return;
    try {
      await leadsApi.remove(lead.id);
      queryClient.setQueryData<Lead[]>(queryKeys.leads, (all) => all?.filter((l) => l.id !== lead.id));
      onClose();
      toast.success("Contact deleted.");
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return (
    <div className={styles.view}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <Avatar name={lead.name} size="lg" />
          <div className={styles.identityText}>
            <h2 className={styles.name}>{primary}</h2>
            <p className={styles.subline}>
              {secondary && <span>{secondary}</span>}
              <span className={lead.phone ? undefined : styles.noPhone}>{lead.phone || "No phone number"}</span>
              <span>{lead.language}</span>
            </p>
            <div className={styles.badges}>
              <QueueBadge lead={lead} />
              <StageBadge lead={lead} />
              <FollowUpBadge lead={lead} />
              {lead.priority === "Urgent" && <Badge tone="danger">Urgent</Badge>}
            </div>
          </div>
        </div>
        <div className={styles.headerActions}>
          {wa && (
            <a className={buttonClass("whatsapp")} href={wa} target="_blank" rel="noopener noreferrer">
              <MessageCircle />
              <span>WhatsApp</span>
            </a>
          )}
          {lead.phone && (
            <a className={buttonClass("secondary")} href={`tel:${lead.phone}`} aria-label={`Call ${lead.phone}`}>
              <Phone />
              <span className={styles.hideSm}>Call</span>
            </a>
          )}
          {lead.route !== "Spam" && lead.route !== "Careers" && (
            <Button icon={<Check />} loading={logging} onClick={logContact}>
              <span className={styles.hideSm}>Log contact</span>
            </Button>
          )}
          {user.role === "Admin" && (
            <Menu
              items={[{ label: "Delete contact", icon: <Trash2 />, danger: true, onSelect: remove }]}
              trigger={(props) => (
                <IconButton label="More actions" variant="secondary" {...props}>
                  <MoreHorizontal />
                </IconButton>
              )}
            />
          )}
          <IconButton label="Close" onClick={onClose} data-autofocus>
            <X />
          </IconButton>
        </div>
      </header>

      <div className={styles.body}>
        <div className={styles.main}>
          {lead.route === "Support" && (
            <div className={styles.callout}>
              <ShieldAlert aria-hidden />
              <p>
                <strong>Human review required.</strong> A payment or cancellation claim isn&apos;t verified until someone
                checks it. This contact will never be marked paid automatically.
              </p>
            </div>
          )}
          {lead.route === "Spam" && (
            <div className={styles.callout}>
              <AlertTriangle aria-hidden />
              <p>
                <strong>Quarantined as spam.</strong> No reply is drafted. Change the queue in Details if this is a real
                enquiry.
              </p>
            </div>
          )}
          <Conversation lead={lead} />
          {lead.route !== "Spam" && <ReplyComposer lead={lead} />}
          <ActivityLog lead={lead} />
        </div>
        <aside className={styles.side}>
          <DetailsForm lead={lead} />
        </aside>
      </div>
    </div>
  );
}
