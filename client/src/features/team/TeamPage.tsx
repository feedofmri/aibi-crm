import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { usersApi } from "@/api/endpoints";
import { Avatar, Badge, Button, Card, Dialog, Field, Input, PageLoader, Select, useToast } from "@/components/ui";
import { PageHeader } from "@/components/layout/PageHeader";
import { useCurrentUser } from "@/features/auth/AuthProvider";
import { queryKeys, useLeads, useMeta, useTeam } from "@/hooks/queries";
import { formatDate } from "@/lib/format";
import type { Tone } from "@/lib/lead";
import type { Role } from "@/types";
import styles from "./TeamPage.module.css";

const ROLE_TONE: Record<Role, Tone> = { Admin: "brand", Admissions: "info", Support: "danger", Sales: "violet" };
const ROLE_TEXT: Record<Role, string> = {
  Admin: "Everything, including team members and deleting contacts",
  Admissions: "Contacts, replies and automation settings",
  Support: "Contacts and replies",
  Sales: "Contacts and replies",
};

export function TeamPage() {
  const me = useCurrentUser();
  const team = useTeam();
  const leads = useLeads();
  const [adding, setAdding] = useState(false);

  const owned = (name: string) => (leads.data ?? []).filter((l) => l.owner === name).length;

  return (
    <>
      <PageHeader
        title="Team"
        description="Who can sign in, and what each role can do. Changes are credited to the person who made them."
        actions={
          me.role === "Admin" ? (
            <Button variant="primary" icon={<UserPlus />} onClick={() => setAdding(true)}>
              Add member
            </Button>
          ) : undefined
        }
      />
      {team.isPending ? (
        <PageLoader label="Loading team" />
      ) : (
        <Card padded={false}>
          <ul className={styles.list}>
            {team.data?.map((member) => (
              <li key={member.id} className={styles.member}>
                <Avatar name={member.name} size="md" />
                <div className={styles.who}>
                  <span className={styles.name}>
                    {member.name}
                    {member.id === me.id && <span className={styles.you}>You</span>}
                  </span>
                  <span className={styles.email}>{member.email}</span>
                </div>
                <div className={styles.role}>
                  <Badge tone={ROLE_TONE[member.role]}>{member.role}</Badge>
                  <span>{ROLE_TEXT[member.role]}</span>
                </div>
                <span className={styles.stat}>
                  <strong className="tabular">{owned(member.name)}</strong> contacts owned
                </span>
                <span className={styles.since}>Joined {formatDate(member.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <AddMemberDialog open={adding} onClose={() => setAdding(false)} />
    </>
  );
}

function AddMemberDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const meta = useMeta();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "Admissions" as Role });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await usersApi.create(form);
      await queryClient.invalidateQueries({ queryKey: queryKeys.users });
      toast.success(`${form.name} can now sign in.`);
      setForm({ name: "", email: "", password: "", role: "Admissions" });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title="Add team member"
      description="They can sign in straight away with this password."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="add-member" loading={busy}>
            Add member
          </Button>
        </>
      }
    >
      <form id="add-member" className={styles.form} onSubmit={submit}>
        <Field label="Full name">
          {(id) => <Input id={id} data-autofocus required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
        </Field>
        <Field label="Email">
          {(id) => <Input id={id} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}
        </Field>
        <Field label="Temporary password" hint="At least 8 characters.">
          {(id, hint) => (
            <Input id={id} aria-describedby={hint} type="password" minLength={8} required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          )}
        </Field>
        <Field label="Role" hint={ROLE_TEXT[form.role]}>
          {(id, hint) => (
            <Select id={id} aria-describedby={hint} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              {meta.data?.roles.map((r) => <option key={r}>{r}</option>)}
            </Select>
          )}
        </Field>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}
