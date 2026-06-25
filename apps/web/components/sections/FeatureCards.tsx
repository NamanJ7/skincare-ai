import { type ReactNode } from "react";
import { Section, SectionHeading } from "../ui/Section";
import { Reveal } from "../ui/Reveal";
import { Badge } from "../ui/Badge";
import { RoutineChecklistMock } from "../mockups/RoutineChecklistMock";
import { CompatibilityMock } from "../mockups/CompatibilityMock";
import { ProgressMock } from "../mockups/ProgressMock";
import { ProductCardMock } from "../mockups/ProductCardMock";

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
    eyebrow: "Personalized Routine Builder",
    title: "A routine built around your skin.",
    body: "Pore helps you build simple AM and PM routines based on your skin concerns, goals, current products, and preferences — no 12-step guesswork.",
    tone: "surface",
    visual: <RoutineChecklistMock />,
  },
  {
    index: "02",
    eyebrow: "Ingredient Compatibility",
    title: "Know what works together.",
    body: "Pore checks ingredients and active products to help you avoid irritating combinations, unnecessary overlap, and confusing routines.",
    tone: "lavender",
    visual: <CompatibilityMock />,
  },
  {
    index: "03",
    eyebrow: "Track Your Progress",
    title: "See what is actually helping.",
    body: "Log your routine, track skin changes over time, and understand which products are worth keeping — with notes and photo comparisons.",
    tone: "cream",
    visual: <ProgressMock />,
  },
  {
    index: "04",
    eyebrow: "Smarter Product Guidance",
    title: "Stop buying products that don't fit.",
    body: "Pore helps you understand what products may support your goals before adding more to your shelf — with a clear routine-fit signal.",
    tone: "muted",
    visual: <ProductCardMock />,
  },
];

export function FeatureCards() {
  return (
    <Section id="features" tone="canvas">
      <Reveal>
        <SectionHeading
          eyebrow="What does Pore include?"
          title="Everything your skincare routine has been missing."
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
