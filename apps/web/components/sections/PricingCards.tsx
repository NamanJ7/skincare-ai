import { PRICING_TIERS, type PricingTier } from "@/lib/pricing";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { WaitlistButton } from "../ui/WaitlistButton";
import { CheckIcon } from "../ui/icons";
import { Reveal } from "../ui/Reveal";

/** The three pricing cards — reused on the home pricing section and /pricing. */
export function PricingCards() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {PRICING_TIERS.map((tier, i) => (
        <Reveal key={tier.id} delay={i * 80}>
          <TierCard tier={tier} />
        </Reveal>
      ))}
    </div>
  );
}

function TierCard({ tier }: { tier: PricingTier }) {
  return (
    <div
      className={`flex h-full flex-col rounded-2xl border p-7 ${
        tier.featured
          ? "border-primary/30 bg-surface shadow-[var(--shadow-lift)] ring-1 ring-primary/10"
          : "border-hairline bg-surface shadow-[var(--shadow-card)]"
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl text-ink">{tier.name}</h3>
        {tier.featured ? <Badge tone="lavender">Most popular</Badge> : null}
      </div>

      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="font-display text-3xl font-semibold text-ink">
          {tier.price}
        </span>
        {tier.cadence ? (
          <span className="text-sm text-ink-muted">/ {tier.cadence}</span>
        ) : null}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{tier.tagline}</p>

      <ul className="mt-6 flex-1 space-y-2.5">
        {tier.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm text-ink">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
              <CheckIcon size={12} />
            </span>
            {f}
          </li>
        ))}
      </ul>

      <div className="mt-7">
        {tier.cta === "waitlist" ? (
          <WaitlistButton
            size="lg"
            variant={tier.featured ? "primary" : "secondary"}
            className="w-full"
          >
            {tier.ctaLabel}
          </WaitlistButton>
        ) : (
          <Button variant="secondary" size="lg" className="w-full" disabled>
            {tier.ctaLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
