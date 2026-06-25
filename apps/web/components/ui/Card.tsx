import { type ReactNode } from "react";

type Tone = "surface" | "cream" | "lavender" | "muted" | "primary";

const tones: Record<Tone, string> = {
  surface: "bg-surface border-hairline",
  cream: "bg-canvas border-hairline",
  lavender: "bg-accent-soft border-[#e4dcf3]",
  muted: "bg-[#f1ede4] border-hairline",
  primary: "bg-primary border-transparent text-on-primary",
};

/** Rounded, hairline-bordered surface with optional hover lift. */
export function Card({
  children,
  tone = "surface",
  hover = false,
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  hover?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border p-6 sm:p-7 shadow-[var(--shadow-card)] ${
        tones[tone]
      } ${
        hover
          ? "transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1.5 hover:shadow-[var(--shadow-lift)]"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
