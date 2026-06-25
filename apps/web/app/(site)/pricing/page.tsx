import type { Metadata } from "next";
import { PageHero } from "@/components/sections/PageHero";
import { Section, SectionHeading } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { PricingCards } from "@/components/sections/PricingCards";
import { Accordion } from "@/components/ui/Accordion";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { CheckIcon } from "@/components/ui/icons";
import { COMPARISON_ROWS, PRICING_FAQ } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Start free and upgrade when you want deeper tracking and personalized insights. Pricing may change before launch — waitlist members hear first.",
};

export default function PricingPage() {
  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title="Simple skincare support, made personal."
        lede="Start free, upgrade when you want deeper tracking and personalized insights. Pricing may change before launch — waitlist members receive early-access details first."
      />

      <Section tone="canvas" className="pt-0 sm:pt-0">
        <PricingCards />
      </Section>

      {/* comparison table */}
      <Section tone="surface">
        <Reveal>
          <SectionHeading
            eyebrow="Compare plans"
            title="What's included in each plan."
          />
        </Reveal>
        <Reveal>
          <div className="mt-10 overflow-x-auto rounded-2xl border border-hairline">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr className="bg-canvas/60">
                  <th className="px-5 py-4 text-sm font-semibold text-ink">
                    Feature
                  </th>
                  {["Free", "Pore Plus", "Pore Pro"].map((c) => (
                    <th
                      key={c}
                      className="px-5 py-4 text-center text-sm font-semibold text-ink"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.label} className="border-t border-hairline">
                    <td className="px-5 py-3.5 text-sm text-ink">{row.label}</td>
                    <Cell value={row.free} />
                    <Cell value={row.plus} />
                    <Cell value={row.pro} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </Section>

      {/* FAQ */}
      <Section tone="canvas">
        <Reveal>
          <SectionHeading eyebrow="FAQ" title="Questions, answered." />
        </Reveal>
        <Reveal>
          <div className="mx-auto mt-10 max-w-2xl">
            <Accordion items={PRICING_FAQ} />
          </div>
        </Reveal>
      </Section>

      <FinalCTA />
    </>
  );
}

function Cell({ value }: { value: boolean | string }) {
  return (
    <td className="px-5 py-3.5 text-center">
      {typeof value === "string" ? (
        <span className="text-sm text-ink-muted">{value}</span>
      ) : value ? (
        <span className="inline-grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-primary">
          <CheckIcon size={13} />
        </span>
      ) : (
        <span className="text-ink-muted/40">—</span>
      )}
    </td>
  );
}
