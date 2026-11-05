import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import styles from "./StatCard.module.css";

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "neutral" | "warning" | "danger" | "brand";
  onClick?: () => void;
}

export function StatCard({ label, value, hint, icon, tone = "neutral", onClick }: StatCardProps) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} className={cx(styles.card, onClick && styles.clickable)} onClick={onClick}>
      <span className={styles.top}>
        <span className={styles.label}>{label}</span>
        {icon && <span className={cx(styles.icon, styles[tone])}>{icon}</span>}
      </span>
      <span className={cx(styles.value, "tabular")}>{value}</span>
      {hint && <span className={styles.hint}>{hint}</span>}
    </Tag>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className={styles.grid}>{children}</div>;
}
