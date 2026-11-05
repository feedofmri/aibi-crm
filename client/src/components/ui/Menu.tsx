import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import styles from "./Menu.module.css";

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface MenuProps {
  trigger: (props: { onClick: () => void; "aria-expanded": boolean; "aria-haspopup": "menu"; "aria-controls": string }) => ReactNode;
  items: (MenuItem | "divider")[];
  header?: ReactNode;
  placement?: "bottom-end" | "top-start" | "top-end";
  className?: string;
}

/** A small accessible dropdown menu (click to open, Escape/outside click to close). */
export function Menu({ trigger, items, header, placement = "bottom-end", className }: MenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    root.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className={cx(styles.root, className)}>
      {trigger({ onClick: () => setOpen((v) => !v), "aria-expanded": open, "aria-haspopup": "menu", "aria-controls": id })}
      {open && (
        <div id={id} role="menu" className={cx(styles.menu, styles[placement])}>
          {header && <div className={styles.header}>{header}</div>}
          {items.map((item, index) =>
            item === "divider" ? (
              <div key={`d${index}`} className={styles.divider} role="separator" />
            ) : (
              <button
                key={item.label}
                role="menuitem"
                type="button"
                disabled={item.disabled}
                className={cx(styles.item, item.danger && styles.danger)}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.icon}
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
