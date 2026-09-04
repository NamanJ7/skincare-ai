import type { Metadata } from "next";
import { PageHero } from "@/components/sections/PageHero";
import { Section, SectionHeading } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { WaitlistButton } from "@/components/ui/WaitlistButton";
import { Button } from "@/components/ui/Button";
import { FeatureTabs } from "@/components/features/FeatureTabs";
import { FinalCTA } from "@/components/sections/FinalCTA";
import {
  CameraIcon,
  DropIcon,
  LeafIcon,
  CheckIcon,
  ChartIcon,
  SparkleIcon,
} from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Guided three-photo capture, a routine clamped by deterministic safety rules, paced actives, and a before-and-after Pore refuses to fake - explore everything Pore does.",
};

const HIGHLIGHTS = [
  {
    icon: <CameraIcon size={20} />,
    title: "Guided capture",
    body: "Three angles under your screen's own light, each measured before it counts.",
  },
  {
    icon: <DropIcon size={20} />,
    title: "Personalized routine",
    body: "Simple AM / PM steps shaped by your photos, your goals, and how your skin reacts.",
  },
  {
    icon: <CheckIcon size={20} />,
    title: "Deterministic safety",
    body: "Sunscreen always, allergens removed, pregnancy-unsafe actives stripped - in code.",
  },
  {
    icon: <LeafIcon size={20} />,
    title: "Paced actives",
    body: "One strong active a day, ramped over six weeks, pulled back when your skin protests.",
  },
  {
    icon: <ChartIcon size={20} />,
    title: "Measured progress",
    body: "Two blind readings subtracted in code - and a refusal when they aren't comparable.",
  },
  {
    icon: <SparkleIcon size={20} />,
    title: "A reason for everything",
    body: "Every step and every adjustment says why - education, never a diagnosis.",
  },
];

export default function FeaturesPage() {
  return (
    <>
      <PageHero
        eyebrow="Features"
        title={<>Everything you need for a routine that makes sense.</>}
        lede="Pore starts with a guided picture of your face, then brings your products, goals, and progress into one place - with a clear reason behind every step."
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
                <h3 className="mt-4 font-display text-lg text-ink">
                  {h.title}
                </h3>
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
