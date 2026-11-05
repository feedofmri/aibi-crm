import icon from "@/assets/brand/biai-icon.png";
import wordmark from "@/assets/brand/biai-logo.png";
import { cx } from "@/lib/cx";
import styles from "./Logo.module.css";

export function Logo({ subtitle = "Admissions", inverted = false }: { subtitle?: string; inverted?: boolean }) {
  return (
    <span className={cx(styles.logo, inverted && styles.inverted)}>
      <img className={styles.icon} src={icon} alt="" width={30} height={30} />
      <span className={styles.text}>
        <img className={styles.wordmark} src={wordmark} alt="BIAI" height={12} />
        <span className={styles.subtitle}>{subtitle}</span>
      </span>
    </span>
  );
}
