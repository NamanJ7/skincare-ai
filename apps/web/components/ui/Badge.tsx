import { type ReactNode } from "react";

type Tone = "primary" | "lavender" | "gold" | "muted" | "soon";

const tones: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  lavender: "bg-accent text-accent-ink",
  gold: "bg-[#f0e9da] text-[#8a754f]",
  muted: "bg-ink/5 text-ink-muted",
  soon: "bg-canvas text-ink-muted border border-hairline",
};

/** Small pill label — categories, "Coming soon", read time, etc. */
export function Badge({
  children,
  tone = "primary",
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-xs font-semibold tracking-wide ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
