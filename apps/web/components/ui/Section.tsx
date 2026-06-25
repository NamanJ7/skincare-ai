import { type ReactNode } from "react";
import { Container } from "./Container";

/** Vertical-rhythm section wrapper. `tone` shifts the background between the
 *  cream canvas and white surface so adjacent sections separate cleanly. */
export function Section({
  children,
  id,
  tone = "canvas",
  className = "",
  containerClassName = "",
}: {
  children: ReactNode;
  id?: string;
  tone?: "canvas" | "surface" | "accent" | "primary";
  className?: string;
  containerClassName?: string;
}) {
  const toneClass =
    tone === "surface"
      ? "bg-surface"
      : tone === "accent"
        ? "bg-accent-soft"
        : tone === "primary"
          ? "bg-primary text-on-primary"
          : "bg-canvas";

  return (
    <section
      id={id}
      className={`py-16 sm:py-20 lg:py-[88px] ${toneClass} ${className}`}
    >
      <Container className={containerClassName}>{children}</Container>
    </section>
  );
}

/** Small eyebrow + serif heading + optional lede, reused atop most sections. */
export function SectionHeading({
  eyebrow,
  title,
  lede,
  align = "center",
  invert = false,
}: {
  eyebrow?: string;
  title: ReactNode;
  lede?: ReactNode;
  align?: "center" | "left";
  invert?: boolean;
}) {
  const alignClass = align === "center" ? "text-center mx-auto" : "text-left";
  return (
    <div className={`max-w-2xl ${alignClass}`}>
      {eyebrow ? (
        <p
          className={`mb-3 text-xs font-semibold uppercase tracking-[0.18em] ${
            invert ? "text-accent" : "text-primary"
          }`}
        >
          {eyebrow}
        </p>
      ) : null}
      <h2
        className={`font-display text-3xl leading-tight sm:text-4xl lg:text-[44px] lg:leading-[1.08] ${
          invert ? "text-on-primary" : "text-ink"
        }`}
      >
        {title}
      </h2>
      {lede ? (
        <p
          className={`mt-4 text-lg leading-relaxed ${
            invert ? "text-on-primary/80" : "text-ink-muted"
          }`}
        >
          {lede}
        </p>
      ) : null}
    </div>
  );
}
