import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import type { Tone } from "@/lib/lead";
import styles from "./Badge.module.css";

interface BadgeProps {
  tone?: Tone;
  dot?: boolean;
  icon?: ReactNode;
  size?: "sm" | "md";
  variant?: "soft" | "outline";
  children: ReactNode;
  className?: string;
  title?: string;
}

export function Badge({ tone = "neutral", dot, icon, size = "md", variant = "soft", children, className, title }: BadgeProps) {
  return (
    <span className={cx(styles.badge, styles[tone], styles[size], styles[variant], className)} title={title}>
      {dot && <span className={styles.dot} aria-hidden />}
      {icon}
      {children}
    </span>
  );
}
