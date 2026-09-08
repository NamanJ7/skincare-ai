import { type ReactNode } from "react";
import { Section, SectionHeading } from "../ui/Section";
import { Reveal } from "../ui/Reveal";
import { Badge } from "../ui/Badge";
import { CompatibilityMock } from "../mockups/CompatibilityMock";
import { ProgressMock } from "../mockups/ProgressMock";
import { RoutineChecklistMock } from "../mockups/RoutineChecklistMock";
import { FaceScanMock } from "../mockups/FaceScanMock";

type Tone = "cream" | "lavender" | "muted" | "surface";

const FEATURES: {
  index: string;
  eyebrow: string;
  title: string;
  body: string;
  tone: Tone;
  visual: ReactNode;
}[] = [
  {
    index: "01",
    eyebrow: "Guided Capture",
    title: "Three photos, taken like an instrument.",
    body: "Straight on and each side, lit by your own screen so every set is shot under the same light. Each frame is measured for focus and exposure before it counts, and a bad one is rejected with one fixable instruction rather than becoming a confident wrong answer.",
    tone: "surface",
    visual: <FaceScanMock />,
  },
  {
    index: "02",
    eyebrow: "Deterministic Safety",
    title: "The rules are code, not a prompt.",
    body: "Sunscreen is always in your morning. One strong active per day, never two. Anything you have reacted to is removed outright, pregnancy-unsafe ingredients are stripped, and how reactive your skin is caps the whole routine. Every change comes with the reason it was made.",
    tone: "lavender",
    visual: <CompatibilityMock />,
  },
  {
    index: "03",
    eyebrow: "Measured Progress",
    title: "We refuse to invent an improvement.",
    body: "Each photo set is assessed on its own, blind, with no idea an earlier one exists — then the two are subtracted in code. If the sets were not shot under comparable light, Pore says it cannot tell you rather than finding a story in them.",
    tone: "cream",
    visual: <ProgressMock />,
  },
  {
    index: "04",
    eyebrow: "One Thing Tonight",
    title: "You never plan a night yourself.",
    body: "Strong actives start once a week and build over six, spaced so two never land together. Report that your skin stung and the routine pulls them for three days on its own. Today shows only the session in front of you, and the reason it looks that way.",
    tone: "muted",
    visual: <RoutineChecklistMock />,
  },
];

export function FeatureCards() {
  return (
    <Section id="features" tone="canvas">
      <Reveal>
        <SectionHeading
          eyebrow="Inside Pore"
          title="An instrument, a rulebook, and one thing to do tonight."
        />
      </Reveal>

      <div className="mt-12 space-y-6">
        {FEATURES.map((f, i) => (
          <Reveal key={f.index} delay={i % 2 === 0 ? 0 : 80}>
            <FeatureRow feature={f} flip={i % 2 === 1} />
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

const toneClass: Record<Tone, string> = {
  cream: "bg-canvas border-hairline",
  lavender: "bg-accent-soft border-[#e4dcf3]",
  muted: "bg-[#f1ede4] border-hairline",
  surface: "bg-surface border-hairline",
};

function FeatureRow({
  feature,
  flip,
}: {
  feature: (typeof FEATURES)[number];
  flip: boolean;
}) {
  return (
    <div
      className={`grid items-center gap-8 rounded-2xl border p-7 sm:p-10 lg:grid-cols-2 ${toneClass[feature.tone]}`}
    >
      <div className={flip ? "lg:order-2" : ""}>
        <div className="flex items-center gap-3">
          <span className="font-display text-sm font-semibold text-primary/60">
            {feature.index}
          </span>
          <Badge tone="primary">{feature.eyebrow}</Badge>
        </div>
        <h3 className="mt-4 font-display text-2xl leading-tight text-ink sm:text-3xl">
          {feature.title}
        </h3>
        <p className="mt-3 max-w-md text-base leading-relaxed text-ink-muted">
          {feature.body}
        </p>
      </div>
      <div
        className={`flex justify-center ${flip ? "lg:order-1 lg:justify-start" : "lg:justify-end"}`}
      >
        {feature.visual}
      </div>
    </div>
  );
}
