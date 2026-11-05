import type { ReactNode } from "react";
import { Search, X } from "lucide-react";
import { Button, Select } from "@/components/ui";
import { useMeta } from "@/hooks/queries";
import type { Programme } from "@/types";
import { UNASSIGNED, type LeadFilters } from "./useLeadFilters";
import styles from "./LeadToolbar.module.css";

interface LeadToolbarProps {
  filters: LeadFilters;
  resultCount: number;
  children?: ReactNode;
}

export function LeadToolbar({ filters, resultCount, children }: LeadToolbarProps) {
  const meta = useMeta();
  return (
    <div className={styles.toolbar}>
      <div className={styles.filters}>
        <label className={styles.search}>
          <Search aria-hidden />
          <span className="visually-hidden">Search contacts</span>
          <input
            type="search"
            placeholder="Search name, phone, message…"
            value={filters.query}
            onChange={(e) => filters.setQuery(e.target.value)}
          />
        </label>
        <Select
          aria-label="Programme"
          className={styles.select}
          value={filters.programme}
          onChange={(e) => filters.setProgramme(e.target.value as Programme | "")}
        >
          <option value="">All programmes</option>
          {meta.data?.programs.map((p) => (
            <option key={p} value={p}>
              {p === "Unspecified" ? "Programme to confirm" : p}
            </option>
          ))}
        </Select>
        <Select aria-label="Owner" className={styles.select} value={filters.owner} onChange={(e) => filters.setOwner(e.target.value)}>
          <option value="">All owners</option>
          <option value={UNASSIGNED}>Unassigned</option>
          {filters.owners.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
        {filters.active && (
          <Button variant="ghost" size="sm" icon={<X />} onClick={filters.reset}>
            Clear
          </Button>
        )}
      </div>
      <div className={styles.end}>
        <span className={styles.count} aria-live="polite">
          {resultCount} {resultCount === 1 ? "contact" : "contacts"}
        </span>
        {children}
      </div>
    </div>
  );
}
