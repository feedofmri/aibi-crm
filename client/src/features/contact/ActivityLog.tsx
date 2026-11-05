import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { cx } from "@/lib/cx";
import type { Lead } from "@/types";
import styles from "./ActivityLog.module.css";

const COLLAPSED = 4;

/** Who did what, newest first. */
export function ActivityLog({ lead }: { lead: Lead }) {
  const [expanded, setExpanded] = useState(false);
  const entries = [...lead.activity].reverse();
  const visible = expanded ? entries : entries.slice(0, COLLAPSED);

  return (
    <Card>
      <CardHeader title="Activity" description="Every change, with who made it" />
      <ol className={styles.timeline}>
        {visible.map((entry) => (
          <li key={entry.id} className={styles.entry}>
            <span className={styles.marker} aria-hidden />
            <div>
              <p className={styles.action}>{entry.action}</p>
              <p className={styles.meta}>
                {entry.author} · <time dateTime={entry.at}>{formatDateTime(entry.at)}</time>
              </p>
            </div>
          </li>
        ))}
      </ol>
      {entries.length > COLLAPSED && (
        <button type="button" className={styles.more} onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
          {expanded ? "Show less" : `Show all ${entries.length} events`}
          <ChevronDown className={cx(styles.chevron, expanded && styles.chevronUp)} />
        </button>
      )}
    </Card>
  );
}
