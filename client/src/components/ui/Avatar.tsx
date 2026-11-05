import { cx } from "@/lib/cx";
import { initials } from "@/lib/lead";
import styles from "./Avatar.module.css";

const PALETTE = ["brand", "blue", "violet", "green", "amber", "rose", "teal", "gray"] as const;

/** Stable colour per name so the same person always looks the same. */
function colorFor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

interface AvatarProps {
  name: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function Avatar({ name, size = "md", className }: AvatarProps) {
  return (
    <span className={cx(styles.avatar, styles[size], styles[colorFor(name || "?")], className)} aria-hidden>
      {initials(name || "?")}
    </span>
  );
}
