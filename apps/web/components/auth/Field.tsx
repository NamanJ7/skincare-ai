import { type InputHTMLAttributes } from "react";

/** Labeled input used by the (visual-only) auth forms. */
export function Field({
  label,
  id,
  hint,
  ...props
}: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 flex items-center justify-between text-sm font-medium text-ink">
        {label}
        {hint ? (
          <span className="text-xs font-normal text-ink-muted">{hint}</span>
        ) : null}
      </span>
      <input
        id={id}
        className="w-full rounded-xl border border-hairline bg-surface px-4 py-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
        {...props}
      />
    </label>
  );
}
