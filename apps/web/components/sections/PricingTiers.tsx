import { Section, SectionHeading } from "../ui/Section";
import { Reveal } from "../ui/Reveal";
import { PricingCards } from "./PricingCards";

export function PricingTiers() {
  return (
    <Section id="pricing" tone="surface">
      <Reveal>
        <SectionHeading
          eyebrow="Pricing"
          title="Simple skincare support, made personal."
          lede="Start free, upgrade when you want deeper tracking and personalized insights."
        />
      </Reveal>

      <div className="mt-12">
        <PricingCards />
      </div>

      <Reveal>
        <p className="mx-auto mt-8 max-w-xl text-center text-sm text-ink-muted">
          Pricing may change before launch. Waitlist members will receive early
          access details first.
        </p>
      </Reveal>
    </Section>
  );
}
