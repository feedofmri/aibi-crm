import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { ChevronDown } from "lucide-react";
import { cx } from "@/lib/cx";
import styles from "./Field.module.css";

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  children: (id: string, describedBy?: string) => ReactNode;
  className?: string;
  action?: ReactNode;
}

/** Label + control + hint/error, with ids wired for accessibility. */
export function Field({ label, hint, error, optional, children, className, action }: FieldProps) {
  const id = useId();
  const hintId = hint || error ? `${id}-hint` : undefined;
  return (
    <div className={cx(styles.field, className)}>
      <div className={styles.labelRow}>
        <label htmlFor={id} className={styles.label}>
          {label}
          {optional && <span className={styles.optional}>Optional</span>}
        </label>
        {action}
      </div>
      {children(id, hintId)}
      {(error || hint) && (
        <p id={hintId} className={cx(styles.hint, error && styles.error)}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...rest }, ref) {
    return <input ref={ref} className={cx(styles.control, invalid && styles.invalid, className)} aria-invalid={invalid || undefined} {...rest} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...rest },
  ref,
) {
  return <textarea ref={ref} className={cx(styles.control, styles.textarea, className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <span className={cx(styles.selectWrap, className)}>
      <select ref={ref} className={cx(styles.control, styles.select)} {...rest}>
        {children}
      </select>
      <ChevronDown className={styles.chevron} aria-hidden />
    </span>
  );
});
