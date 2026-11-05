import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import styles from "./Segmented.module.css";

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  count?: number;
  icon?: ReactNode;
}

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  label: string;
  variant?: "pill" | "tabs";
  className?: string;
}

/** Single-choice toggle group (view switchers, filter tabs). */
export function Segmented<T extends string>({ value, onChange, options, label, variant = "pill", className }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={cx(styles.group, styles[variant], className)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            className={cx(styles.option, selected && styles.selected)}
            onClick={() => onChange(option.value)}
          >
            {option.icon}
            <span>{option.label}</span>
            {option.count !== undefined && <span className={cx(styles.count, "tabular")}>{option.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
