import { type ReactNode } from "react";
import { Container } from "../ui/Container";
import { Glow } from "../ui/Glow";
import { Reveal } from "../ui/Reveal";

/** Compact centered hero for inner pages (features, pricing, blog). */
export function PageHero({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  lede?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden pb-8 pt-14 sm:pb-12 sm:pt-20">
      <Glow tone="lavender" size={460} className="left-1/2 top-[-140px] -translate-x-1/2" />
      <Container className="relative">
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            {eyebrow}
          </p>
          <h1 className="mt-4 font-display text-4xl leading-[1.06] text-ink sm:text-5xl lg:text-[56px]">
            {title}
          </h1>
          {lede ? (
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-ink-muted">
              {lede}
            </p>
          ) : null}
          {children ? <div className="mt-8">{children}</div> : null}
        </Reveal>
      </Container>
    </section>
  );
}
