import type { Metadata } from "next";
import { PageHero } from "@/components/sections/PageHero";
import { Section, SectionHeading } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { WaitlistButton } from "@/components/ui/WaitlistButton";
import { Button } from "@/components/ui/Button";
import { FeatureTabs } from "@/components/features/FeatureTabs";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { DropIcon, LeafIcon, CheckIcon, ChartIcon, SparkleIcon, CameraIcon } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Personalized routines, a product shelf you understand, ingredient compatibility, progress tracking, and AI guidance — explore everything Pore does.",
};

const HIGHLIGHTS = [
  { icon: <DropIcon size={20} />, title: "Personalized routines", body: "Simple AM / PM routines shaped by your skin, goals, and products." },
  { icon: <LeafIcon size={20} />, title: "Product shelf", body: "Catalog what you own so Pore builds around your real routine." },
  { icon: <CheckIcon size={20} />, title: "Ingredient compatibility", body: "Avoid irritating combinations with gentle, plain-language checks." },
  { icon: <ChartIcon size={20} />, title: "Progress tracking", body: "Track consistency, notes, and visible changes over time." },
  { icon: <SparkleIcon size={20} />, title: "AI guidance", body: "Personalized guidance as your skin changes — education, not diagnosis." },
  { icon: <CameraIcon size={20} />, title: "Future mobile access", body: "Start on the web; mobile access is coming soon." },
];

export default function FeaturesPage() {
  return (
    <>
      <PageHero
        eyebrow="Features"
        title={<>Everything you need for a routine that makes sense.</>}
        lede="Pore brings your skin, products, goals, and progress into one place — with a clear reason behind every step."
      >
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <WaitlistButton size="lg" />
          <Button href="/pricing" variant="secondary" size="lg">
            See pricing
          </Button>
        </div>
      </PageHero>

      {/* highlight grid */}
      <Section tone="canvas">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {HIGHLIGHTS.map((h, i) => (
            <Reveal key={h.title} delay={(i % 3) * 80}>
              <div className="flex h-full flex-col rounded-2xl border border-hairline bg-surface p-6 shadow-[var(--shadow-card)]">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                  {h.icon}
                </span>
                <h3 className="mt-4 font-display text-lg text-ink">{h.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                  {h.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* interactive tabs */}
      <Section tone="surface">
        <Reveal>
          <SectionHeading
            eyebrow="Explore Pore"
            title="A closer look at how it all fits together."
          />
        </Reveal>
        <div className="mt-12">
          <FeatureTabs />
        </div>
      </Section>

      <FinalCTA />
    </>
  );
}
