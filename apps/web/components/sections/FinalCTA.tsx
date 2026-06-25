import { Section } from "../ui/Section";
import { Reveal } from "../ui/Reveal";
import { Glow } from "../ui/Glow";
import { WaitlistButton } from "../ui/WaitlistButton";

/** Slim waitlist band reused at the bottom of inner pages. */
export function FinalCTA({
  title = "Your skincare routine is about to get smarter.",
  body = "Join the Pore waitlist for early access, product updates, and first access to new features.",
}: {
  title?: string;
  body?: string;
}) {
  return (
    <Section tone="canvas">
      <Reveal>
        <div className="relative overflow-hidden rounded-[32px] border border-hairline bg-surface px-7 py-12 text-center sm:px-12 sm:py-16">
          <Glow tone="green" size={420} className="left-1/2 top-[-140px] -translate-x-1/2" />
          <h2 className="relative font-display text-3xl leading-tight text-ink sm:text-4xl">
            {title}
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-lg leading-relaxed text-ink-muted">
            {body}
          </p>
          <div className="relative mt-7 flex justify-center">
            <WaitlistButton size="lg" />
          </div>
          <p className="relative mt-4 text-sm text-ink-muted">
            No spam. Just thoughtful updates from Pore.
          </p>
        </div>
      </Reveal>
    </Section>
  );
}
