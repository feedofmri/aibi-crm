import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ArrowRight, BellRing, Languages, ShieldCheck } from "lucide-react";
import { Avatar, Button, Field, Input } from "@/components/ui";
import { Logo } from "@/components/layout/Logo";
import { useAuth } from "./AuthProvider";
import styles from "./LoginPage.module.css";

const DEMO_PASSWORD = "Admin123!";
const DEMO_ACCOUNTS = [
  { name: "Admin BIAI", email: "admin@biai.com.bd", role: "Admin" },
  { name: "Tanvir Ahmed", email: "tanvir@biai.com.bd", role: "Admissions" },
  { name: "Ayesha Siddiqua", email: "ayesha@biai.com.bd", role: "Support" },
  { name: "Rahim Chowdhury", email: "rahim@biai.com.bd", role: "Sales" },
];

const HIGHLIGHTS = [
  { icon: <Languages />, title: "Bangla, Banglish and English", text: "Extract details and draft a reply in the sender's language." },
  { icon: <BellRing />, title: "Nobody waits more than 48 hours", text: "A follow-up queue that puts urgent and support cases first." },
  { icon: <ShieldCheck />, title: "People stay in control", text: "Every AI result is reviewed. Nothing is sent or marked paid automatically." },
];

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<string | null>(null);

  async function submit(emailValue: string, passwordValue: string, key: string) {
    setError("");
    setPending(key);
    try {
      await signIn(emailValue, passwordValue);
      const from = params.get("from");
      navigate(from && from.startsWith("/") ? from : "/pipeline", { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setPending(null);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void submit(email, password, "form");
  }

  return (
    <div className={styles.page}>
      <section className={styles.brandPanel} aria-label="About BIAI Admissions">
        <Logo inverted />
        <div className={styles.pitch}>
          <h1>Every enquiry answered, every follow-up on time.</h1>
          <p>One workspace for BIAI&apos;s WhatsApp, Facebook, website and phone enquiries.</p>
        </div>
        <ul className={styles.highlights}>
          {HIGHLIGHTS.map((item) => (
            <li key={item.title}>
              <span className={styles.highlightIcon}>{item.icon}</span>
              <span>
                <strong>{item.title}</strong>
                <span>{item.text}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className={styles.legal}>Prototype · all contacts are fictional sample data</p>
      </section>

      <section className={styles.formPanel}>
        <div className={styles.formCard}>
          <div className={styles.mobileLogo}>
            <Logo />
          </div>
          <h2 className={styles.formTitle}>Sign in</h2>
          <p className={styles.formSubtitle}>Use your team account to continue.</p>

          <form className={styles.form} onSubmit={onSubmit} noValidate>
            <Field label="Email">
              {(id) => (
                <Input
                  id={id}
                  type="email"
                  autoComplete="username"
                  placeholder="name@biai.com.bd"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              )}
            </Field>
            <Field label="Password">
              {(id) => (
                <Input
                  id={id}
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              )}
            </Field>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            <Button type="submit" variant="primary" size="lg" block loading={pending === "form"} disabled={!email || !password}>
              Sign in
            </Button>
          </form>

          <div className={styles.divider}>
            <span>Demo accounts</span>
          </div>
          <ul className={styles.demoList}>
            {DEMO_ACCOUNTS.map((account) => (
              <li key={account.email}>
                <button
                  type="button"
                  className={styles.demoAccount}
                  disabled={pending !== null}
                  onClick={() => submit(account.email, DEMO_PASSWORD, account.email)}
                >
                  <Avatar name={account.name} size="sm" />
                  <span className={styles.demoText}>
                    <strong>{account.name}</strong>
                    <span>{account.role}</span>
                  </span>
                  {pending === account.email ? <span className={styles.demoHint}>Signing in…</span> : <ArrowRight className={styles.demoArrow} />}
                </button>
              </li>
            ))}
          </ul>
          <p className={styles.demoNote}>
            All demo accounts use the password <code>{DEMO_PASSWORD}</code>.
          </p>
        </div>
      </section>
    </div>
  );
}
