import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/cx";
import styles from "./Card.module.css";

interface CardProps extends HTMLAttributes<HTMLElement> {
  padded?: boolean;
  as?: "section" | "div" | "article";
}

export function Card({ padded = true, as: Tag = "section", className, children, ...rest }: CardProps) {
  return (
    <Tag className={cx(styles.card, padded && styles.padded, className)} {...rest}>
      {children}
    </Tag>
  );
}

interface CardHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}

export function CardHeader({ title, description, action, icon }: CardHeaderProps) {
  return (
    <div className={styles.header}>
      {icon && <span className={styles.icon}>{icon}</span>}
      <div className={styles.headings}>
        <h3 className={styles.title}>{title}</h3>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
